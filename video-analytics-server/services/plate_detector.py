import cv2
import numpy as np
import re
import os
import uuid
import logging
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path

from core.config import PLATES_DIR, SNAPSHOTS_DIR

logger = logging.getLogger("video_analytics.plate_detector")

# Common Optical Character Disambiguation Maps
CHAR_TO_NUM = {'O': '0', 'I': '1', 'Z': '2', 'B': '8', 'S': '5', 'G': '6', 'Q': '0', 'D': '0'}
NUM_TO_CHAR = {'0': 'O', '1': 'I', '2': 'Z', '8': 'B', '5': 'S', '6': 'G'}

# Regex patterns for Indian & standard vehicle plates
# Standard: DL01AB1234 or HR26DQ5678 or UP16B1234 or MH121234
INDIA_PLATE_PATTERN = re.compile(r'^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$')
GENERAL_PLATE_PATTERN = re.compile(r'^[A-Z0-9]{5,11}$')

class PlateDetector:
    def __init__(self):
        self._init_templates()

    def _init_templates(self):
        """
        Creates synthetic 28x28 binary character templates for 0-9 and A-Z
        using standard OpenCV font rendering to perform high-speed matching
        without requiring external Tesseract or heavy OCR dependencies.
        """
        self.templates = {}
        chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        for ch in chars:
            img = np.zeros((36, 24), dtype=np.uint8)
            # Render font centered
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.9
            thickness = 2
            (text_w, text_h), baseline = cv2.getTextSize(ch, font, font_scale, thickness)
            x = max(0, (24 - text_w) // 2)
            y = max(text_h, (36 + text_h) // 2) - 2
            cv2.putText(img, ch, (x, y), font, font_scale, 255, thickness, lineType=cv2.LINE_AA)
            self.templates[ch] = img

    def sanitize_plate_text(self, raw_text: str) -> str:
        """
        Sanitizes and normalizes detected characters into valid license plate format.
        """
        cleaned = re.sub(r'[^A-Z0-9]', '', raw_text.upper().strip())
        if len(cleaned) < 4:
            return cleaned

        chars = list(cleaned)
        # For Indian format: first 2 chars must be state code (Letters)
        if len(chars) >= 2:
            for i in range(2):
                if chars[i] in NUM_TO_CHAR:
                    chars[i] = NUM_TO_CHAR[chars[i]]

        # The last 4 chars are typically digits
        if len(chars) >= 6:
            for i in range(len(chars) - 4, len(chars)):
                if chars[i] in CHAR_TO_NUM:
                    chars[i] = CHAR_TO_NUM[chars[i]]

        candidate = "".join(chars)
        return candidate

    def detect_candidate_plates(self, frame: np.ndarray) -> List[Tuple[np.ndarray, List[int]]]:
        """
        Detects rectangular license plate regions in the frame.
        Returns list of (plate_crop, [x, y, w, h]).
        """
        h, w = frame.shape[:2]
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Bilateral filter to reduce noise while keeping edges sharp
        blur = cv2.bilateralFilter(gray, 9, 75, 75)

        # Morphological gradient / Sobel edge detection in X direction
        grad_x = cv2.Sobel(blur, ddepth=cv2.CV_16S, dx=1, dy=0, ksize=3)
        grad_x = cv2.convertScaleAbs(grad_x)

        # Otsu thresholding
        _, thresh = cv2.threshold(grad_x, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # Morph close with rectangular kernel to bridge characters in plate
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (19, 5))
        closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

        # Find external contours
        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        candidates = []
        for cnt in contours:
            x, y, cw, ch = cv2.boundingRect(cnt)
            aspect_ratio = float(cw) / float(ch) if ch > 0 else 0
            area = cw * ch

            # Plate filters: width >= 70, height >= 18, aspect ratio between 1.8 and 6.0
            if cw >= 60 and ch >= 16 and 1.8 <= aspect_ratio <= 6.5 and area < (w * h * 0.4):
                # Extra margin
                px1 = max(0, x - 5)
                py1 = max(0, y - 5)
                px2 = min(w, x + cw + 5)
                py2 = min(h, y + ch + 5)
                crop = frame[py1:py2, px1:px2]
                if crop.size > 0:
                    candidates.append((crop, [px1, py1, px2 - px1, py2 - py1]))

        return candidates

    def recognize_characters(self, plate_crop: np.ndarray) -> Tuple[str, float]:
        """
        Segments and recognizes characters within the cropped plate image.
        Returns (plate_number, confidence).
        """
        if plate_crop.size == 0 or plate_crop.shape[0] < 12 or plate_crop.shape[1] < 40:
            return "", 0.0

        # Resize to standard height for OCR processing
        target_h = 60
        scale = target_h / plate_crop.shape[0]
        target_w = int(plate_crop.shape[1] * scale)
        resized = cv2.resize(plate_crop, (target_w, target_h), interpolation=cv2.INTER_CUBIC)

        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
        
        # Adaptive thresholding to isolate characters
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 19, 9
        )

        # Optional Tesseract OCR if installed
        try:
            import pytesseract
            config = '--psm 8 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
            tess_text = pytesseract.image_to_string(thresh, config=config)
            sanitized = self.sanitize_plate_text(tess_text)
            if len(sanitized) >= 4:
                return sanitized, 0.92
        except Exception:
            pass

        # Native Character Contour Extraction & Template Matching
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        char_boxes = []

        for cnt in contours:
            cx, cy, cw, ch = cv2.boundingRect(cnt)
            # Filter character contours by height and aspect ratio
            if 0.35 * target_h <= ch <= 0.95 * target_h and 4 <= cw <= target_w * 0.3:
                aspect = float(cw) / float(ch)
                if 0.15 <= aspect <= 1.2:
                    char_boxes.append((cx, cy, cw, ch))

        # Sort characters left to right
        char_boxes.sort(key=lambda b: b[0])

        recognized_chars = []
        confidences = []

        for (cx, cy, cw, ch) in char_boxes:
            char_patch = thresh[cy:cy+ch, cx:cx+cw]
            # Resize patch to template size (36, 24)
            char_norm = cv2.resize(char_patch, (24, 36), interpolation=cv2.INTER_AREA)

            best_char = '?'
            best_score = -1.0

            for cand_char, tmpl in self.templates.items():
                # Normalized Cross-Correlation
                res = cv2.matchTemplate(char_norm, tmpl, cv2.TM_CCOEFF_NORMED)
                score = res[0][0]
                if score > best_score:
                    best_score = score
                    best_char = cand_char

            if best_score > 0.40 and best_char != '?':
                recognized_chars.append(best_char)
                confidences.append(best_score)

        raw_str = "".join(recognized_chars)
        sanitized = self.sanitize_plate_text(raw_str)
        avg_conf = float(np.mean(confidences)) if confidences else 0.0

        return sanitized, round(avg_conf, 3)

    def process_frame(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        Full pipeline for ANPR on a video frame:
        Detects plate regions -> recognizes text -> returns valid detections.
        """
        candidates = self.detect_candidate_plates(frame)
        results = []

        for plate_crop, box in candidates:
            plate_text, conf = self.recognize_characters(plate_crop)
            # Accept if string is 4-11 alphanumeric characters
            if len(plate_text) >= 4 and len(plate_text) <= 12:
                # Save snapshot of cropped plate
                filename = f"plate_{plate_text}_{uuid.uuid4().hex[:6]}.jpg"
                crop_path = PLATES_DIR / filename
                cv2.imwrite(str(crop_path), plate_crop)

                results.append({
                    "plate_number": plate_text,
                    "confidence": conf,
                    "box": box,
                    "snapshot_path": f"/storage/plates/{filename}",
                    "crop_image": plate_crop
                })

        return results

# Global singleton instance
plate_detector = PlateDetector()
