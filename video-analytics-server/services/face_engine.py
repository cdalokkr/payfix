import cv2
import numpy as np
import base64
import os
import uuid
import logging
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path

from core.config import settings, FACES_DIR, SNAPSHOTS_DIR
from core.database import get_all_person_embeddings, get_setting

logger = logging.getLogger("video_analytics.face_engine")

class FaceEngine:
    def __init__(self):
        self.yunet_detector = None
        self.arcface_net = None
        self.haar_cascade = None
        self._init_models()

    def _init_models(self):
        # 1. Initialize YuNet Face Detector
        try:
            if os.path.exists(settings.YUNET_MODEL_PATH):
                self.yunet_detector = cv2.FaceDetectorYN.create(
                    settings.YUNET_MODEL_PATH,
                    "",
                    (320, 320),
                    score_threshold=0.6,
                    nms_threshold=0.3,
                    top_k=5000
                )
                logger.info(f"YuNet face detector loaded from {settings.YUNET_MODEL_PATH}")
            else:
                logger.warning(f"YuNet model file not found at {settings.YUNET_MODEL_PATH}")
        except Exception as e:
            logger.error(f"Failed to load YuNet: {e}")

        # 2. Initialize Haar Cascade as fallback
        try:
            if hasattr(cv2, 'data') and hasattr(cv2.data, 'haarcascades'):
                cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
                if os.path.exists(cascade_path):
                    self.haar_cascade = cv2.CascadeClassifier(cascade_path)
                    logger.info("Haar Cascade face detector fallback initialized.")
        except Exception as e:
            logger.error(f"Failed to load Haar cascade: {e}")

        # 3. Initialize ArcFace 512-d ONNX Feature Extractor
        try:
            if os.path.exists(settings.ARCFACE_MODEL_PATH):
                self.arcface_net = cv2.dnn.readNetFromONNX(settings.ARCFACE_MODEL_PATH)
                logger.info(f"ArcFace ONNX loaded from {settings.ARCFACE_MODEL_PATH}")
            else:
                logger.warning(f"ArcFace model file not found at {settings.ARCFACE_MODEL_PATH}")
        except Exception as e:
            logger.error(f"Failed to load ArcFace ONNX: {e}")

    def detect_faces(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        Detects faces in frame.
        Returns list of dicts: {'box': [x, y, w, h], 'score': float, 'landmarks': ...}
        """
        h, w = frame.shape[:2]
        detected = []

        if self.yunet_detector is not None:
            try:
                self.yunet_detector.setInputSize((w, h))
                _, faces = self.yunet_detector.detect(frame)
                if faces is not None:
                    for f in faces:
                        fx, fy, fw, fh = int(f[0]), int(f[1]), int(f[2]), int(f[3])
                        score = float(f[14])
                        # Bound check
                        fx = max(0, fx)
                        fy = max(0, fy)
                        fw = min(w - fx, fw)
                        fh = min(h - fy, fh)
                        if fw > 20 and fh > 20:
                            detected.append({
                                "box": [fx, fy, fw, fh],
                                "score": score,
                                "source": "yunet"
                            })
                    if detected:
                        return detected
            except Exception as e:
                logger.debug(f"YuNet detection exception: {e}")

        # Fallback to Haar Cascade
        if self.haar_cascade is not None:
            try:
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                faces = self.haar_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
                for (fx, fy, fw, fh) in faces:
                    detected.append({
                        "box": [int(fx), int(fy), int(fw), int(fh)],
                        "score": 0.85,
                        "source": "haar"
                    })
            except Exception as e:
                logger.debug(f"Haar cascade detection exception: {e}")

        return detected

    def extract_embedding(self, frame: np.ndarray, box: List[int]) -> Optional[List[float]]:
        """
        Crops face with box [x, y, w, h], aligns/resizes to (112, 112)
        and extracts 512-d normalized L2 embedding using ArcFace ONNX.
        """
        if self.arcface_net is None:
            return None

        x, y, w, h = box
        img_h, img_w = frame.shape[:2]

        # Add modest padding (15%) around face box
        pad_w = int(w * 0.15)
        pad_h = int(h * 0.15)
        x1 = max(0, x - pad_w)
        y1 = max(0, y - pad_h)
        x2 = min(img_w, x + w + pad_w)
        y2 = min(img_h, y + h + pad_h)

        face_crop = frame[y1:y2, x1:x2]
        if face_crop.size == 0 or face_crop.shape[0] < 10 or face_crop.shape[1] < 10:
            return None

        try:
            # ArcFace input: 112x112, BGR->RGB, normalized (val - 127.5) / 127.5
            blob = cv2.dnn.blobFromImage(
                face_crop,
                scalefactor=1.0 / 127.5,
                size=(112, 112),
                mean=(127.5, 127.5, 127.5),
                swapRB=True,
                crop=False
            )
            self.arcface_net.setInput(blob)
            emb = self.arcface_net.forward()[0]

            # L2 normalize
            norm = np.linalg.norm(emb)
            if norm > 1e-6:
                emb = emb / norm
            return emb.tolist()
        except Exception as e:
            logger.error(f"Error in ArcFace embedding extraction: {e}")
            return None

    def match_face(self, query_emb: List[float]) -> Dict[str, Any]:
        """
        Compares query embedding with all registered persons in database.
        Returns match dict with:
        {'matched': bool, 'person_id': str, 'name': str, 'similarity': float, 'access_status': str}
        """
        threshold = float(get_setting("face_similarity_threshold", str(settings.FACE_SIMILARITY_THRESHOLD)))
        enrolled = get_all_person_embeddings()

        if not enrolled or not query_emb:
            return {
                "matched": False,
                "person_id": None,
                "name": "Unknown Person",
                "similarity": 0.0,
                "access_status": "UNKNOWN"
            }

        q_vec = np.array(query_emb, dtype=np.float32)
        best_sim = -1.0
        best_match = None

        for item in enrolled:
            cand_vec = np.array(item["embedding"], dtype=np.float32)
            # Dot product of unit vectors = Cosine similarity
            sim = float(np.dot(q_vec, cand_vec))
            if sim > best_sim:
                best_sim = sim
                best_match = item

        if best_match and best_sim >= threshold:
            return {
                "matched": True,
                "person_id": best_match["id"],
                "name": best_match["name"],
                "similarity": round(best_sim, 4),
                "access_status": best_match["access_status"]  # 'ALLOWED', 'BLOCKED', 'VISITOR'
            }

        return {
            "matched": False,
            "person_id": None,
            "name": "Unknown Visitor",
            "similarity": round(max(0.0, best_sim), 4),
            "access_status": "UNKNOWN"
        }

    def process_person_enrollment(self, image_data: bytes, person_id: str) -> Tuple[Optional[List[float]], Optional[str]]:
        """
        Processes uploaded image bytes for enrolling a person:
        - Decodes image
        - Detects best face
        - Extracts 512-d embedding
        - Saves cropped profile photo to storage/faces/{person_id}.jpg
        """
        nparr = np.frombuffer(image_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            return None, None

        faces = self.detect_faces(frame)
        if not faces:
            # If no face detector hit, use whole image as center crop
            h, w = frame.shape[:2]
            box = [0, 0, w, h]
        else:
            # Pick largest face
            faces.sort(key=lambda f: f["box"][2] * f["box"][3], reverse=True)
            box = faces[0]["box"]

        emb = self.extract_embedding(frame, box)
        
        # Save cropped face photo
        x, y, w, h = box
        img_h, img_w = frame.shape[:2]
        crop = frame[max(0, y):min(img_h, y+h), max(0, x):min(img_w, x+w)]
        if crop.size == 0:
            crop = frame

        photo_filename = f"{person_id}_{uuid.uuid4().hex[:6]}.jpg"
        photo_path = FACES_DIR / photo_filename
        cv2.imwrite(str(photo_path), crop)

        relative_path = f"/storage/faces/{photo_filename}"
        return emb, relative_path

# Global singleton instance
face_engine = FaceEngine()
