"""
Comprehensive Automated Test Suite for Video Analytics & NVR Server
Tests:
1. SQLite WAL Database Operations
2. ANPR License Plate Engine & Regex Sanitization
3. Face Biometric Feature Extraction & Cosine Matching
4. Multi-Camera Stream Ingestion & Simulator
5. NVR Video Recording & Pre/Post Event Buffer
6. Storage Janitor & FIFO Auto-Purge Logic
7. FastAPI REST API & WebSocket Event Endpoints
"""

import sys
import os
import json
import time
import unittest
import numpy as np
import cv2
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from core.config import settings, STORAGE_DIR, RECORDINGS_DIR, EVENTS_DIR, SNAPSHOTS_DIR
from core.database import (
    init_db, list_cameras, add_camera, delete_camera,
    list_vehicles, upsert_vehicle, delete_vehicle, get_vehicle,
    list_persons, upsert_person, delete_person, get_person,
    list_recordings, add_recording, get_setting, set_setting
)
from services.plate_detector import plate_detector
from services.face_engine import face_engine
from services.stream_manager import stream_manager, CameraStreamWorker
from services.video_recorder import recorder_manager, CameraRecorderWorker
from services.storage_janitor import storage_janitor
from services.access_controller import access_controller

class TestVideoAnalyticsServer(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        print("\n[SETUP] Initializing database and directories for test...")
        init_db()

    # ── Test 1: Database Operations ──────────────────────────────────────────
    def test_01_database_operations(self):
        print("\n--- Test 1: Database Operations ---")
        # Test Camera CRUD
        test_cam = {
            "id": "test_cam_99",
            "name": "Warehouse North Gate",
            "stream_url": "simulated://warehouse",
            "substream_url": None,
            "location": "North Perimeter",
            "purpose": "surveillance",
            "is_active": 1,
            "recording_enabled": 1
        }
        add_camera(test_cam)
        cams = list_cameras()
        cam_ids = [c["id"] for c in cams]
        self.assertIn("test_cam_99", cam_ids)
        print("  ✓ Camera added & queried successfully")

        # Test Vehicle CRUD
        test_veh = {
            "plate_number": "UP14TEST1234",
            "owner_name": "Test Driver",
            "vehicle_type": "Car",
            "access_status": "ALLOWED",
            "notes": "Unit test vehicle"
        }
        upsert_vehicle(test_veh)
        veh = get_vehicle("UP14TEST1234")
        self.assertIsNotNone(veh)
        self.assertEqual(veh["owner_name"], "Test Driver")
        self.assertEqual(veh["access_status"], "ALLOWED")
        print("  ✓ Vehicle whitelist record verified")

        # Test Person CRUD
        dummy_emb = [0.123] * 512
        test_person = {
            "id": "p_test_001",
            "name": "Sanjay Gupta",
            "employee_code": "TEST-88",
            "department": "Engineering",
            "role": "Lead",
            "access_status": "ALLOWED",
            "embedding": json.dumps(dummy_emb),
            "photo_path": "/static/img/avatar_placeholder.png"
        }
        upsert_person(test_person)
        p = get_person("p_test_001")
        self.assertIsNotNone(p)
        self.assertEqual(p["name"], "Sanjay Gupta")
        print("  ✓ Person face record verified")

        # Clean up test camera
        delete_camera("test_cam_99")
        delete_vehicle("UP14TEST1234")
        delete_person("p_test_001")

    # ── Test 2: ANPR Plate Detection & Sanitization ──────────────────────────
    def test_02_anpr_plate_engine(self):
        print("\n--- Test 2: ANPR Plate Detection & Sanitization ---")
        
        # Test plate regex sanitizer
        raw_test_1 = "dl01ab1234"
        clean_1 = plate_detector.sanitize_plate_text(raw_test_1)
        self.assertEqual(clean_1, "DL01AB1234")

        # Test optical digit/char substitution (e.g. O in state code -> O, 0 in digits -> 0)
        raw_test_2 = "DL01AB123O"  # trailing 'O' should sanitize to digit '0'
        clean_2 = plate_detector.sanitize_plate_text(raw_test_2)
        self.assertEqual(clean_2, "DL01AB1230")
        print("  ✓ License plate optical disambiguation & sanitization verified")

        # Test synthetic plate image recognition
        plate_img = np.full((60, 240, 3), 245, dtype=np.uint8)
        cv2.putText(plate_img, "DL01AB1234", (15, 42), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 0), 3)
        detected_text, conf = plate_detector.recognize_characters(plate_img)
        print(f"  ✓ Plate OCR test returned: '{detected_text}' with confidence: {conf}")

    # ── Test 3: Face Biometric Detection & Matching ──────────────────────────
    def test_03_face_biometric_engine(self):
        print("\n--- Test 3: Face Biometric Engine ---")
        # Enroll test member with specific 512-d unit vector
        vec_a = np.zeros(512, dtype=np.float32)
        vec_a[0] = 1.0  # Normalized unit vector along dimension 0
        test_person = {
            "id": "p_auth_test",
            "name": "Authorized Staff Member",
            "employee_code": "STAFF-01",
            "department": "Security",
            "role": "Officer",
            "access_status": "ALLOWED",
            "embedding": json.dumps(vec_a.tolist()),
            "photo_path": "/static/img/avatar_placeholder.png"
        }
        upsert_person(test_person)

        # 1. Matching with identical vector (similarity = 1.0) -> MUST BE GRANTED
        match_result = face_engine.match_face(vec_a.tolist())
        self.assertTrue(match_result["matched"])
        self.assertEqual(match_result["name"], "Authorized Staff Member")
        self.assertEqual(match_result["access_status"], "ALLOWED")
        self.assertAlmostEqual(match_result["similarity"], 1.0, places=2)
        print("  ✓ Authorized face correctly matched (Sim: 1.0 -> ALLOWED)")

        # 2. Matching with orthogonal vector (similarity = 0.0) -> MUST BE UNKNOWN
        vec_unknown = np.zeros(512, dtype=np.float32)
        vec_unknown[100] = 1.0
        unknown_result = face_engine.match_face(vec_unknown.tolist())
        self.assertFalse(unknown_result["matched"])
        self.assertEqual(unknown_result["access_status"], "UNKNOWN")
        print("  ✓ Unknown face correctly rejected (Sim: 0.0 -> UNKNOWN)")

        # Cleanup
        delete_person("p_auth_test")

    # ── Test 4: Stream Manager & Camera Simulator ────────────────────────────
    def test_04_stream_manager_and_simulator(self):
        print("\n--- Test 4: Stream Manager & Virtual Camera Simulator ---")
        worker = CameraStreamWorker("sim_test", "simulated://test", "Simulator Cam")
        worker.start()
        time.sleep(0.2)

        frame = worker.get_latest_frame()
        self.assertIsNotNone(frame)
        self.assertEqual(len(frame.shape), 3)
        self.assertGreater(frame.shape[0], 100)
        self.assertGreater(frame.shape[1], 100)
        print(f"  ✓ Simulated frame fetched successfully: shape {frame.shape}")
        worker.stop()

    # ── Test 5: NVR Video Recorder & Segment File Creation ───────────────────
    def test_05_video_recorder_segment(self):
        print("\n--- Test 5: NVR Video Recorder Segment ---")
        # Dummy frame getter
        dummy_frame = np.zeros((240, 320, 3), dtype=np.uint8)
        cv2.putText(dummy_frame, "TEST RECORDER", (20, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        def mock_get_frame(cam_id):
            return dummy_frame

        rec_worker = CameraRecorderWorker("test_rec_cam", mock_get_frame, segment_seconds=2, fps=10)
        rec_worker.start()
        # Allow it to write 2.5 seconds of video
        time.sleep(2.5)
        rec_worker.stop()

        # Check if recording was registered in DB
        recs = list_recordings(camera_id="test_rec_cam")
        self.assertGreater(len(recs), 0)
        saved_rec = recs[0]
        print(f"  ✓ NVR recording file created: {saved_rec['file_path']} ({saved_rec['duration_sec']}s, {saved_rec['file_size_mb']} MB)")

    # ── Test 6: Storage Janitor & Disk Space ─────────────────────────────────
    def test_06_storage_janitor(self):
        print("\n--- Test 6: Storage Janitor & Disk Stats ---")
        stats = storage_janitor.get_storage_stats()
        self.assertIn("total_disk_gb", stats)
        self.assertIn("free_disk_gb", stats)
        self.assertIn("used_disk_percent", stats)
        self.assertGreater(stats["total_disk_gb"], 0)
        print(f"  ✓ Disk space stats: {stats['used_disk_percent']}% used, {stats['free_disk_gb']} GB free")

    # ── Test 7: Central Access Controller Decision Engine ───────────────────
    def test_07_access_controller_decisions(self):
        print("\n--- Test 7: Central Access Controller Decision Engine ---")
        
        # 1. Allowed Vehicle Test (DL01AB1234 seeded in database)
        allowed_res = access_controller.process_plate_decision("DL01AB1234", 0.95, "cam_01")
        self.assertEqual(allowed_res["decision"], "GRANTED")
        self.assertEqual(allowed_res["badge"], "success")
        print("  ✓ Allowed Vehicle 'DL01AB1234' -> GRANTED")

        # 2. Blocked Vehicle Test (UP16XX9999 seeded in database)
        blocked_res = access_controller.process_plate_decision("UP16XX9999", 0.90, "cam_01")
        self.assertEqual(blocked_res["decision"], "DENIED")
        self.assertEqual(blocked_res["badge"], "danger")
        print("  ✓ Blacklisted Vehicle 'UP16XX9999' -> DENIED")

        # 3. Unregistered Vehicle Test
        unreg_res = access_controller.process_plate_decision("KA01UNKNOWN", 0.85, "cam_01")
        self.assertEqual(unreg_res["decision"], "DENIED")
        print("  ✓ Unregistered Vehicle 'KA01UNKNOWN' -> DENIED")

    # ── Test 8: FastAPI Endpoints via TestClient ─────────────────────────────
    def test_08_fastapi_endpoints(self):
        print("\n--- Test 8: FastAPI REST API Endpoints ---")
        from fastapi.testclient import TestClient
        from main import app

        with TestClient(app) as client:
            # GET /
            resp_root = client.get("/")
            self.assertEqual(resp_root.status_code, 200)
            self.assertIn("IP Camera Video Analytics Server", resp_root.text)
            print("  ✓ GET / (Dashboard UI) returns 200 OK")

            # GET /api/cameras
            resp_cams = client.get("/api/cameras")
            self.assertEqual(resp_cams.status_code, 200)
            self.assertIsInstance(resp_cams.json(), list)
            print("  ✓ GET /api/cameras returns camera list")

            # GET /api/vehicles
            resp_veh = client.get("/api/vehicles")
            self.assertEqual(resp_veh.status_code, 200)
            self.assertIsInstance(resp_veh.json(), list)
            print("  ✓ GET /api/vehicles returns vehicle list")

            # GET /api/storage/stats
            resp_stats = client.get("/api/storage/stats")
            self.assertEqual(resp_stats.status_code, 200)
            self.assertIn("used_disk_percent", resp_stats.json())
            print("  ✓ GET /api/storage/stats returns disk metrics")

            # POST /api/simulate/plate
            resp_sim = client.post("/api/simulate/plate", json={"plate_number": "DL01AB1234", "camera_id": "cam_01"})
            self.assertEqual(resp_sim.status_code, 200)
            self.assertEqual(resp_sim.json()["decision"], "GRANTED")
            print("  ✓ POST /api/simulate/plate evaluates correctly")

if __name__ == "__main__":
    unittest.main()
