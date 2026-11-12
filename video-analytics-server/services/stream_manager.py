import cv2
import time
import os
import threading
import logging
import numpy as np
from typing import Dict, Optional, Generator, Tuple
from datetime import datetime

from core.database import list_cameras, get_camera
from services.onvif_service import sanitize_rtsp_url

logger = logging.getLogger("video_analytics.stream_manager")

class CameraStreamWorker:
    def __init__(self, camera_id: str, stream_url: str, name: str = ""):
        self.camera_id = camera_id
        # Automatically clean, fix typos (e.g. 192.1680. -> 192.168.), and encode credentials
        self.raw_stream_url = stream_url
        self.stream_url, self.url_warning = sanitize_rtsp_url(stream_url)
        self.name = name or camera_id
        self.is_running = False
        self.is_connected = False
        self.latest_frame: Optional[np.ndarray] = None
        self.lock = threading.Lock()
        self.thread: Optional[threading.Thread] = None
        self.simulated = self.stream_url.startswith("simulated://") or self.stream_url == "mock"
        self._sim_step = 0
        if self.url_warning:
            logger.warning(f"[{self.camera_id}] {self.url_warning}")

    def update_url(self, new_url: str):
        """Updates the stream URL dynamically and forces reconnect."""
        with self.lock:
            self.raw_stream_url = new_url
            self.stream_url, self.url_warning = sanitize_rtsp_url(new_url)
            self.simulated = self.stream_url.startswith("simulated://") or self.stream_url == "mock"
            self.is_connected = False
            logger.info(f"Updated stream URL for {self.camera_id} to {self.stream_url}")

    def start(self):
        if self.is_running:
            return
        self.is_running = True
        self.thread = threading.Thread(target=self._run, daemon=True, name=f"Stream-{self.camera_id}")
        self.thread.start()
        logger.info(f"Started camera worker for {self.camera_id} ({self.stream_url})")

    def stop(self):
        self.is_running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=2.0)
        logger.info(f"Stopped camera worker for {self.camera_id}")

    def get_latest_frame(self) -> Optional[np.ndarray]:
        with self.lock:
            if self.latest_frame is not None:
                return self.latest_frame.copy()
            return None

    def _generate_simulated_frame(self) -> np.ndarray:
        self._sim_step += 1
        h, w = 480, 720
        frame = np.full((h, w, 3), 35, dtype=np.uint8)

        # Draw road lane markings
        cv2.line(frame, (0, 380), (w, 380), (80, 80, 80), 3)
        cv2.line(frame, (0, 470), (w, 470), (80, 80, 80), 3)
        dash_x = (self._sim_step * 5) % 80
        for x in range(dash_x - 80, w + 80, 60):
            cv2.line(frame, (x, 425), (x + 30, 425), (200, 200, 200), 2)

        # Draw moving vehicle
        car_x = (self._sim_step * 4) % (w + 200) - 100
        car_y = 310
        if -100 <= car_x <= w + 100:
            cv2.rectangle(frame, (car_x, car_y), (car_x + 180, car_y + 80), (140, 70, 20), -1)
            cv2.rectangle(frame, (car_x + 30, car_y - 35), (car_x + 140, car_y), (140, 70, 20), -1)
            cv2.rectangle(frame, (car_x + 40, car_y - 30), (car_x + 130, car_y - 5), (200, 220, 240), -1)
            cv2.circle(frame, (car_x + 40, car_y + 80), 16, (15, 15, 15), -1)
            cv2.circle(frame, (car_x + 140, car_y + 80), 16, (15, 15, 15), -1)
            plate_text = "DL01AB1234" if (self._sim_step // 250) % 2 == 0 else "HR26DQ5678"
            plate_w, plate_h = 100, 26
            px = car_x + 40
            py = car_y + 45
            cv2.rectangle(frame, (px, py), (px + plate_w, py + plate_h), (245, 245, 245), -1)
            cv2.rectangle(frame, (px, py), (px + plate_w, py + plate_h), (10, 10, 10), 2)
            cv2.rectangle(frame, (px, py), (px + 12, py + plate_h), (180, 80, 20), -1)
            cv2.putText(frame, plate_text, (px + 16, py + 19), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 2, cv2.LINE_AA)

        # Booth
        cv2.rectangle(frame, (w - 120, 150), (w - 20, 380), (60, 60, 60), -1)
        cv2.rectangle(frame, (w - 110, 160), (w - 30, 230), (220, 240, 255), -1)
        cv2.putText(frame, "SECURITY BOOTH", (w - 115, 140), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (180, 180, 180), 1)

        # Barrier
        cv2.line(frame, (w - 120, 360), (w - 320, 360), (0, 0, 240), 6)
        cv2.line(frame, (w - 180, 360), (w - 220, 360), (255, 255, 255), 6)

        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cv2.rectangle(frame, (0, 0), (w, 36), (20, 20, 20), -1)
        cv2.circle(frame, (18, 18), 6, (0, 0, 240), -1)
        cv2.putText(frame, f"REC  [{self.name}]", (32, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA)
        cv2.putText(frame, now_str, (w - 210, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1, cv2.LINE_AA)

        return frame

    def _run(self):
        # Force TCP transport and optimal buffers for IP camera H.264 streams
        os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = (
            "rtsp_transport;tcp"
            "|buffer_size;2048000"
            "|max_delay;500000"
            "|stimeout;5000000"
            "|reorder_queue_size;50"
        )

        while self.is_running:
            if self.simulated:
                self.is_connected = True
                frame = self._generate_simulated_frame()
                with self.lock:
                    self.latest_frame = frame
                time.sleep(0.04)
                continue

            cap = None
            try:
                current_url = self.stream_url
                logger.info(f"Connecting to camera {self.camera_id} at {current_url}...")
                cap = cv2.VideoCapture(current_url, cv2.CAP_FFMPEG)
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 3)

                if not cap.isOpened():
                    logger.warning(f"Could not open stream for {self.camera_id}. Retrying in 4s...")
                    self.is_connected = False
                    time.sleep(4.0)
                    continue

                self.is_connected = True
                logger.info(f"Stream opened successfully for {self.camera_id}")

                consecutive_failures = 0
                while self.is_running and cap.isOpened():
                    ret, frame = cap.read()
                    if not ret or frame is None:
                        consecutive_failures += 1
                        # Only trigger full reconnect after 30 consecutive dropped frames (~1.5s)
                        if consecutive_failures > 30:
                            logger.warning(f"Continuous frame read failure for {self.camera_id}. Reconnecting...")
                            self.is_connected = False
                            break
                        time.sleep(0.01)
                        continue

                    consecutive_failures = 0

                    with self.lock:
                        self.latest_frame = frame

                    time.sleep(0.005)

            except Exception as e:
                logger.error(f"Stream exception for {self.camera_id}: {e}")
                self.is_connected = False
                time.sleep(4.0)
            finally:
                if cap is not None:
                    cap.release()

class StreamManager:
    def __init__(self):
        self.workers: Dict[str, CameraStreamWorker] = {}
        self.lock = threading.Lock()

    def start_all(self):
        cameras = list_cameras()
        for cam in cameras:
            if cam["is_active"]:
                self.add_camera_worker(cam["id"], cam["stream_url"], cam["name"])

    def add_camera_worker(self, camera_id: str, stream_url: str, name: str = ""):
        with self.lock:
            if camera_id in self.workers:
                self.workers[camera_id].stop()
            worker = CameraStreamWorker(camera_id, stream_url, name)
            self.workers[camera_id] = worker
            worker.start()

    def remove_camera_worker(self, camera_id: str):
        with self.lock:
            if camera_id in self.workers:
                self.workers[camera_id].stop()
                del self.workers[camera_id]

    def get_frame(self, camera_id: str) -> Optional[np.ndarray]:
        with self.lock:
            worker = self.workers.get(camera_id)
            if worker:
                return worker.get_latest_frame()
            return None

    def is_camera_connected(self, camera_id: str) -> bool:
        with self.lock:
            worker = self.workers.get(camera_id)
            return worker.is_connected if worker else False

    def generate_mjpeg(self, camera_id: str) -> Generator[bytes, None, None]:
        while True:
            frame = self.get_frame(camera_id)
            if frame is None:
                # Placeholder frame
                frame = np.zeros((360, 640, 3), dtype=np.uint8)
                cv2.putText(frame, f"Connecting to {camera_id}...", (160, 180), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 165, 255), 2)
                time.sleep(0.5)
            else:
                # Resize if ultra high resolution to conserve browser memory & bandwidth
                h, w = frame.shape[:2]
                if w > 1280:
                    scale = 1280.0 / w
                    frame = cv2.resize(frame, (1280, int(h * scale)), interpolation=cv2.INTER_AREA)

            ret, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if ret:
                frame_bytes = buffer.tobytes()
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            time.sleep(0.04)

    def stop_all(self):
        with self.lock:
            for worker in self.workers.values():
                worker.stop()
            self.workers.clear()

stream_manager = StreamManager()
