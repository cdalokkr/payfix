import time
import os
import cv2
import json
import uuid
import logging
import urllib.request
import threading
from datetime import datetime
from typing import Dict, Any, Optional, List, Callable

from core.config import settings, SNAPSHOTS_DIR
from core.database import (
    get_vehicle, log_vehicle_event,
    log_face_event, get_setting
)
from services.face_engine import face_engine
from services.plate_detector import plate_detector
from services.video_recorder import recorder_manager
from services.stream_manager import stream_manager

logger = logging.getLogger("video_analytics.access_controller")

class AccessController:
    def __init__(self):
        self.websocket_broadcaster: Optional[Callable[[Dict[str, Any]], None]] = None
        # Debounce tracking: {key: last_triggered_timestamp}
        self.cooldowns: Dict[str, float] = {}
        self.cooldown_seconds = 10.0
        self.is_running = False
        self.thread: Optional[threading.Thread] = None

    def set_broadcaster(self, fn: Callable[[Dict[str, Any]], None]):
        self.websocket_broadcaster = fn

    def trigger_relay(self, reason: str, entity_id: str):
        """
        Triggers external gate relay / boom barrier via HTTP webhook or IP relay.
        """
        webhook_url = get_setting("relay_webhook_url", settings.GATE_RELAY_URL)
        if not webhook_url:
            return

        def _send():
            try:
                payload = json.dumps({
                    "action": "OPEN_GATE",
                    "reason": reason,
                    "entity_id": entity_id,
                    "timestamp": datetime.now().isoformat()
                }).encode('utf-8')
                req = urllib.request.Request(
                    webhook_url,
                    data=payload,
                    headers={"Content-Type": "application/json"}
                )
                with urllib.request.urlopen(req, timeout=3.0) as resp:
                    logger.info(f"Relay trigger sent successfully to {webhook_url}: {resp.status}")
            except Exception as e:
                logger.warning(f"Could not trigger relay at {webhook_url}: {e}")

        threading.Thread(target=_send, daemon=True).start()

    def process_plate_decision(self, plate_number: str, confidence: float, camera_id: str, frame: Optional[any] = None) -> Dict[str, Any]:
        """
        Evaluates detected plate number against whitelist/blacklist.
        """
        clean_plate = plate_number.strip().upper().replace(" ", "").replace("-", "")
        now = time.time()

        # Cooldown check to avoid multi-triggers for same vehicle in 10s
        last_time = self.cooldowns.get(f"plate_{clean_plate}", 0)
        is_debounced = (now - last_time) < self.cooldown_seconds
        self.cooldowns[f"plate_{clean_plate}"] = now

        vehicle_rec = get_vehicle(clean_plate)
        if vehicle_rec:
            owner_name = vehicle_rec["owner_name"]
            status = vehicle_rec["access_status"]
            if status == "ALLOWED":
                decision = "GRANTED"
                badge = "success"
                message = f"Vehicle {clean_plate} ({owner_name}) - ENTRY GRANTED"
            elif status == "BLOCKED":
                decision = "DENIED"
                badge = "danger"
                message = f"ALERT: Blacklisted Vehicle {clean_plate} ({owner_name}) - ENTRY DENIED!"
            else:
                decision = "VISITOR"
                badge = "warning"
                message = f"Visitor Vehicle {clean_plate} ({owner_name}) - Verification Required"
        else:
            owner_name = "Unregistered Vehicle"
            status = "UNKNOWN"
            decision = "DENIED"
            badge = "danger"
            message = f"Unregistered Vehicle {clean_plate} - ENTRY DENIED"

        # Save snapshot
        snapshot_rel = None
        if frame is not None:
            snap_name = f"snap_plate_{clean_plate}_{uuid.uuid4().hex[:6]}.jpg"
            snap_path = SNAPSHOTS_DIR / snap_name
            cv2.imwrite(str(snap_path), frame)
            snapshot_rel = f"/storage/snapshots/{snap_name}"

        # Trigger event clip recording if not debounced
        clip_rel = None
        if not is_debounced:
            clip_rel = recorder_manager.trigger_event_recording(camera_id, "plate", clean_plate)

        # Log event in database
        log_id = log_vehicle_event({
            "camera_id": camera_id,
            "plate_number": clean_plate,
            "owner_name": owner_name,
            "access_status": decision,
            "confidence": confidence,
            "snapshot_path": snapshot_rel,
            "event_clip_path": clip_rel
        })

        event_payload = {
            "type": "plate_event",
            "id": log_id,
            "camera_id": camera_id,
            "plate_number": clean_plate,
            "owner_name": owner_name,
            "decision": decision,
            "badge": badge,
            "message": message,
            "confidence": confidence,
            "snapshot_path": snapshot_rel,
            "event_clip_path": clip_rel,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        # Trigger Relay if GRANTED
        if decision == "GRANTED" and not is_debounced:
            self.trigger_relay("VEHICLE_WHITELIST", clean_plate)

        # Broadcast via WebSocket to dashboard
        if self.websocket_broadcaster:
            self.websocket_broadcaster(event_payload)

        return event_payload

    def process_face_decision(self, embedding: List[float], camera_id: str, frame: Optional[any] = None, box: Optional[List[int]] = None) -> Dict[str, Any]:
        """
        Evaluates detected face embedding against enrolled persons directory.
        """
        match_res = face_engine.match_face(embedding)
        person_name = match_res["name"]
        person_id = match_res["person_id"]
        status = match_res["access_status"]
        similarity = match_res["similarity"]

        now = time.time()
        debounce_key = f"face_{person_id or 'unknown'}"
        last_time = self.cooldowns.get(debounce_key, 0)
        is_debounced = (now - last_time) < self.cooldown_seconds
        self.cooldowns[debounce_key] = now

        if match_res["matched"]:
            if status == "ALLOWED":
                decision = "GRANTED"
                badge = "success"
                message = f"Person {person_name} ({similarity*100:.1f}%) - ENTRY GRANTED"
            elif status == "BLOCKED":
                decision = "DENIED"
                badge = "danger"
                message = f"SECURITY ALERT: Blocked Person {person_name} - ENTRY DENIED!"
            else:
                decision = "VISITOR"
                badge = "warning"
                message = f"Visitor {person_name} - Escort Required"
        else:
            decision = "DENIED"
            badge = "secondary"
            message = f"Unknown Stranger Detected - ENTRY DENIED"

        # Save snapshot
        snapshot_rel = None
        if frame is not None:
            snap_name = f"snap_face_{uuid.uuid4().hex[:8]}.jpg"
            snap_path = SNAPSHOTS_DIR / snap_name
            if box is not None:
                # Save cropped face
                x, y, w, h = box
                ih, iw = frame.shape[:2]
                crop = frame[max(0, y-10):min(ih, y+h+10), max(0, x-10):min(iw, x+w+10)]
                cv2.imwrite(str(snap_path), crop if crop.size > 0 else frame)
            else:
                cv2.imwrite(str(snap_path), frame)
            snapshot_rel = f"/storage/snapshots/{snap_name}"

        # Trigger event clip recording if not debounced
        clip_rel = None
        if not is_debounced:
            clip_rel = recorder_manager.trigger_event_recording(camera_id, "face", person_name.replace(" ", "_"))

        # Log event in database
        log_id = log_face_event({
            "camera_id": camera_id,
            "person_id": person_id or "STRANGER",
            "person_name": person_name,
            "similarity": similarity,
            "access_status": decision,
            "snapshot_path": snapshot_rel,
            "event_clip_path": clip_rel
        })

        event_payload = {
            "type": "face_event",
            "id": log_id,
            "camera_id": camera_id,
            "person_id": person_id,
            "person_name": person_name,
            "similarity": similarity,
            "decision": decision,
            "badge": badge,
            "message": message,
            "snapshot_path": snapshot_rel,
            "event_clip_path": clip_rel,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        # Trigger Relay if GRANTED
        if decision == "GRANTED" and not is_debounced:
            self.trigger_relay("FACE_WHITELIST", person_name)

        # Broadcast via WebSocket to dashboard
        if self.websocket_broadcaster:
            self.websocket_broadcaster(event_payload)

        return event_payload

    def start_analytics_loop(self):
        """
        Background worker that continuously pulls camera frames and runs analytics.
        Runs at throttled rate (e.g. 5 FPS) to keep CPU low.
        """
        if self.is_running:
            return
        self.is_running = True
        self.thread = threading.Thread(target=self._analytics_worker, daemon=True, name="AnalyticsWorker")
        self.thread.start()
        logger.info("Background video analytics worker started.")

    def stop_analytics_loop(self):
        self.is_running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=2.0)
        logger.info("Background video analytics worker stopped.")

    def _analytics_worker(self):
        while self.is_running:
            time.sleep(0.35)  # Analyze ~3 frames per second per camera
            try:
                for cam_id, worker in list(stream_manager.workers.items()):
                    frame = worker.get_latest_frame()
                    if frame is None:
                        continue

                    # 1. License Plate Detection & Recognition
                    plate_results = plate_detector.process_frame(frame)
                    for pr in plate_results:
                        self.process_plate_decision(
                            plate_number=pr["plate_number"],
                            confidence=pr["confidence"],
                            camera_id=cam_id,
                            frame=frame
                        )

                    # 2. Face Detection & Recognition
                    faces = face_engine.detect_faces(frame)
                    for f in faces:
                        box = f["box"]
                        emb = face_engine.extract_embedding(frame, box)
                        if emb is not None:
                            self.process_face_decision(
                                embedding=emb,
                                camera_id=cam_id,
                                frame=frame,
                                box=box
                            )
            except Exception as e:
                logger.error(f"Error in analytics worker loop: {e}")

# Global singleton instance
access_controller = AccessController()
