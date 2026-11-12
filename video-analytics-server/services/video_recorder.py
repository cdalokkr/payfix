import cv2
import time
import os
import threading
import logging
import numpy as np
from collections import deque
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Deque, Tuple

from core.config import settings, RECORDINGS_DIR, EVENTS_DIR
from core.database import add_recording

logger = logging.getLogger("video_analytics.recorder")

def _normalize_rec_frame(frame: np.ndarray) -> np.ndarray:
    """Resizes ultra high-res frames (e.g. 2560x1440) to standard 1280x720 HD for efficient storage and browser playback."""
    h, w = frame.shape[:2]
    if w > 1280:
        scale = 1280.0 / w
        return cv2.resize(frame, (1280, int(h * scale)), interpolation=cv2.INTER_AREA)
    return frame

class CameraRecorderWorker:
    def __init__(self, camera_id: str, get_frame_fn, segment_seconds: int = 300, fps: int = 15):
        self.camera_id = camera_id
        self.get_frame_fn = get_frame_fn
        self.segment_seconds = segment_seconds
        self.fps = fps
        self.is_running = False
        self.thread: Optional[threading.Thread] = None

        # Compressed JPEG ring buffer to avoid allocating 2+ GB RAM for 2K/4K frames
        max_buffer_len = settings.PRE_EVENT_BUFFER_SECONDS * self.fps
        self.ring_buffer: Deque[Tuple[bytes, float]] = deque(maxlen=max_buffer_len)
        self.buffer_lock = threading.Lock()

    def start(self):
        if self.is_running:
            return
        self.is_running = True
        self.thread = threading.Thread(target=self._run, daemon=True, name=f"Recorder-{self.camera_id}")
        self.thread.start()
        logger.info(f"Started continuous video recorder for camera {self.camera_id}")

    def stop(self):
        self.is_running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=3.0)
        logger.info(f"Stopped video recorder for camera {self.camera_id}")

    def trigger_event_recording(self, event_type: str, label: str) -> str:
        now = datetime.now()
        date_str = now.strftime("%Y%m%d_%H%M%S")
        clean_label = "".join(c for c in label if c.isalnum() or c in ('_', '-'))
        safe_cam_id = self.camera_id.replace(" ", "_")
        filename = f"{safe_cam_id}_{event_type}_{clean_label}_{date_str}.mp4"
        event_path = EVENTS_DIR / filename
        relative_path = f"/storage/events/{filename}"

        # Snapshot compressed frames from buffer
        with self.buffer_lock:
            pre_compressed = list(self.ring_buffer)

        post_frames_needed = settings.POST_EVENT_BUFFER_SECONDS * self.fps

        clip_thread = threading.Thread(
            target=self._write_event_clip,
            args=(str(event_path), relative_path, pre_compressed, post_frames_needed, event_type),
            daemon=True
        )
        clip_thread.start()

        return relative_path

    def _write_event_clip(self, file_path: str, relative_path: str, pre_compressed: list, post_frames_needed: int, event_type: str):
        # Decode pre-event frames from compact JPEG
        frames = []
        for (jpg_bytes, _) in pre_compressed:
            try:
                dec = cv2.imdecode(np.frombuffer(jpg_bytes, np.uint8), cv2.IMREAD_COLOR)
                if dec is not None:
                    frames.append(dec)
            except Exception:
                pass

        start_time = datetime.now()
        interval = 1.0 / self.fps

        # Capture post-event frames
        for _ in range(post_frames_needed):
            if not self.is_running:
                break
            raw = self.get_frame_fn(self.camera_id)
            if raw is not None:
                frames.append(_normalize_rec_frame(raw))
            time.sleep(interval)

        if not frames:
            return

        end_time = datetime.now()
        h, w = frames[0].shape[:2]
        fourcc = cv2.VideoWriter_fourcc(*settings.FOURCC)
        writer = cv2.VideoWriter(file_path, fourcc, self.fps, (w, h))

        for f in frames:
            writer.write(f)
        writer.release()

        file_size_mb = 0.0
        if os.path.exists(file_path):
            file_size_mb = round(os.path.getsize(file_path) / (1024 * 1024), 2)

        duration = len(frames) / float(self.fps)

        add_recording({
            "camera_id": self.camera_id,
            "file_path": relative_path,
            "start_time": start_time.strftime("%Y-%m-%d %H:%M:%S"),
            "end_time": end_time.strftime("%Y-%m-%d %H:%M:%S"),
            "duration_sec": round(duration, 1),
            "file_size_mb": file_size_mb,
            "is_event_clip": 1,
            "event_type": event_type
        })
        logger.info(f"Saved event clip {file_path} ({duration:.1f}s, {file_size_mb} MB)")

    def _run(self):
        interval = 1.0 / self.fps
        safe_cam_id = self.camera_id.replace(" ", "_")

        while self.is_running:
            now = datetime.now()
            day_dir = RECORDINGS_DIR / safe_cam_id / now.strftime("%Y-%m-%d")
            day_dir.mkdir(parents=True, exist_ok=True)

            segment_name = f"{safe_cam_id}_{now.strftime('%H-%M-%S')}.mp4"
            segment_path = day_dir / segment_name
            relative_path = f"/storage/continuous/{safe_cam_id}/{now.strftime('%Y-%m-%d')}/{segment_name}"

            segment_start = datetime.now()
            writer = None
            frame_count = 0
            segment_deadline = time.time() + self.segment_seconds

            while self.is_running and time.time() < segment_deadline:
                raw_frame = self.get_frame_fn(self.camera_id)
                if raw_frame is not None:
                    norm_frame = _normalize_rec_frame(raw_frame)

                    # Compress into JPEG for low-memory ring buffer (only ~80 KB per frame)
                    ret, buf = cv2.imencode(".jpg", norm_frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
                    if ret:
                        with self.buffer_lock:
                            self.ring_buffer.append((buf.tobytes(), time.time()))

                    if writer is None:
                        h, w = norm_frame.shape[:2]
                        fourcc = cv2.VideoWriter_fourcc(*settings.FOURCC)
                        writer = cv2.VideoWriter(str(segment_path), fourcc, self.fps, (w, h))

                    writer.write(norm_frame)
                    frame_count += 1

                time.sleep(interval)

            if writer is not None:
                writer.release()
                segment_end = datetime.now()

                file_size_mb = 0.0
                if os.path.exists(segment_path):
                    file_size_mb = round(os.path.getsize(segment_path) / (1024 * 1024), 2)

                duration = frame_count / float(self.fps) if self.fps > 0 else 0.0

                if frame_count > 0:
                    add_recording({
                        "camera_id": self.camera_id,
                        "file_path": relative_path,
                        "start_time": segment_start.strftime("%Y-%m-%d %H:%M:%S"),
                        "end_time": segment_end.strftime("%Y-%m-%d %H:%M:%S"),
                        "duration_sec": round(duration, 1),
                        "file_size_mb": file_size_mb,
                        "is_event_clip": 0,
                        "event_type": "continuous"
                    })
                    logger.info(f"Segment saved: {relative_path} ({duration:.1f}s, {file_size_mb} MB)")

class VideoRecorderManager:
    def __init__(self):
        self.workers: Dict[str, CameraRecorderWorker] = {}
        self.lock = threading.Lock()

    def start_recorder(self, camera_id: str, get_frame_fn):
        with self.lock:
            if camera_id in self.workers:
                self.workers[camera_id].stop()
            worker = CameraRecorderWorker(camera_id, get_frame_fn, segment_seconds=settings.SEGMENT_DURATION_SECONDS)
            self.workers[camera_id] = worker
            worker.start()

    def stop_recorder(self, camera_id: str):
        with self.lock:
            if camera_id in self.workers:
                self.workers[camera_id].stop()
                del self.workers[camera_id]

    def trigger_event_recording(self, camera_id: str, event_type: str, label: str) -> Optional[str]:
        with self.lock:
            worker = self.workers.get(camera_id)
            if worker:
                return worker.trigger_event_recording(event_type, label)
            return None

    def stop_all(self):
        with self.lock:
            for worker in self.workers.values():
                worker.stop()
            self.workers.clear()

recorder_manager = VideoRecorderManager()
