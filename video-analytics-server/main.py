import os
import sys
import json
import logging
import uuid
import numpy as np
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, Request, UploadFile, File, Form, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware

# Ensure path resolution
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from core.config import settings, STORAGE_DIR, SNAPSHOTS_DIR, FACES_DIR, PLATES_DIR
from core.database import (
    init_db, list_cameras, add_camera, update_camera, delete_camera, get_camera,
    list_vehicles, upsert_vehicle, delete_vehicle, list_vehicle_logs,
    list_persons, upsert_person, delete_person, get_person, list_face_logs,
    list_recordings, get_setting, set_setting
)
from core.models import (
    CameraCreate, CameraUpdate, StreamTestRequest, OnvifProfilesRequest,
    VehicleCreate, PersonCreate, SystemSettingsUpdate
)
from services.onvif_service import (
    sanitize_rtsp_url, test_rtsp_stream_live,
    probe_ws_discovery, get_onvif_camera_profiles
)
from services.stream_manager import stream_manager
from services.video_recorder import recorder_manager
from services.storage_janitor import storage_janitor
from services.face_engine import face_engine
from services.plate_detector import plate_detector
from services.access_controller import access_controller

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("video_analytics.main")

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        text_data = json.dumps(message)
        for connection in list(self.active_connections):
            try:
                await connection.send_text(text_data)
            except Exception:
                self.disconnect(connection)

ws_manager = ConnectionManager()

# Bridge access_controller callbacks to WebSocket broadcaster
import asyncio
loop = None

def broadcast_sync(payload: dict):
    global loop
    try:
        if loop and loop.is_running():
            asyncio.run_coroutine_threadsafe(ws_manager.broadcast(payload), loop)
    except Exception as e:
        logger.debug(f"Broadcast sync error: {e}")

access_controller.set_broadcaster(broadcast_sync)

@asynccontextmanager
async def lifespan(app: FastAPI):
    global loop
    loop = asyncio.get_running_loop()

    # 1. Initialize DB
    init_db()

    # 2. Start Camera Streams & Recorders
    stream_manager.start_all()
    for cam in list_cameras():
        if cam["is_active"] and cam["recording_enabled"]:
            recorder_manager.start_recorder(cam["id"], stream_manager.get_frame)

    # 3. Start Analytics Loop & Storage Janitor
    access_controller.start_analytics_loop()
    storage_janitor.start()

    logger.info("IP Camera Video Analytics & NVR Server initialized successfully.")
    yield

    # Shutdown
    logger.info("Shutting down Video Analytics Server...")
    access_controller.stop_analytics_loop()
    recorder_manager.stop_all()
    stream_manager.stop_all()
    storage_janitor.stop()

app = FastAPI(
    title="IP Camera Video Analytics & NVR Server",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static & Storage Mounts
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
app.mount("/storage", StaticFiles(directory=str(STORAGE_DIR)), name="storage")

templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

# ── Web UI Root ──────────────────────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
async def serve_dashboard(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")

# ── WebSocket ────────────────────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keepalive receiver
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)

# ── Live MJPEG Stream ────────────────────────────────────────────────────────
@app.get("/api/stream/{camera_id}")
async def get_camera_stream(camera_id: str):
    return StreamingResponse(
        stream_manager.generate_mjpeg(camera_id),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

# ── Camera Management API ────────────────────────────────────────────────────
@app.get("/api/cameras")
async def api_list_cameras():
    return list_cameras()

@app.post("/api/cameras")
async def api_add_camera(cam: CameraCreate):
    data = cam.model_dump()
    data["is_active"] = 1 if data["is_active"] else 0
    data["recording_enabled"] = 1 if data["recording_enabled"] else 0
    add_camera(data)
    stream_manager.add_camera_worker(cam.id, cam.stream_url, cam.name)
    if cam.recording_enabled:
        recorder_manager.start_recorder(cam.id, stream_manager.get_frame)
    return {"status": "ok", "message": f"Camera {cam.id} saved"}

@app.get("/api/cameras/{camera_id}")
async def api_get_camera(camera_id: str):
    cam = get_camera(camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    return cam

@app.put("/api/cameras/{camera_id}")
async def api_update_camera(camera_id: str, updates: CameraUpdate):
    existing = get_camera(camera_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Camera not found")
    
    update_data = updates.model_dump(exclude_unset=True)
    if "is_active" in update_data:
        update_data["is_active"] = 1 if update_data["is_active"] else 0
    if "recording_enabled" in update_data:
        update_data["recording_enabled"] = 1 if update_data["recording_enabled"] else 0
    
    update_camera(camera_id, update_data)
    
    # Reload worker with updated stream URL / name
    merged = get_camera(camera_id)
    if merged and merged["is_active"]:
        stream_manager.add_camera_worker(camera_id, merged["stream_url"], merged["name"])
        if merged["recording_enabled"]:
            recorder_manager.start_recorder(camera_id, stream_manager.get_frame)
        else:
            recorder_manager.stop_recorder(camera_id)
    else:
        stream_manager.remove_camera_worker(camera_id)
        recorder_manager.stop_recorder(camera_id)
        
    return {"status": "ok", "message": f"Camera {camera_id} updated successfully", "camera": merged}

@app.post("/api/cameras/test-stream")
async def api_test_stream(req: StreamTestRequest):
    return test_rtsp_stream_live(req.stream_url)

# ── ONVIF Integration API ───────────────────────────────────────────────────
@app.get("/api/onvif/discover")
async def api_onvif_discover():
    """Discovers ONVIF IP cameras on the local network via WS-Discovery."""
    try:
        devices = probe_ws_discovery(timeout=2.0)
        return {"status": "ok", "devices": devices}
    except Exception as e:
        logger.error(f"ONVIF discovery error: {e}")
        return {"status": "error", "devices": [], "message": str(e)}

@app.post("/api/onvif/profiles")
async def api_onvif_profiles(req: OnvifProfilesRequest):
    """Fetches device info and stream profiles from an ONVIF IP camera."""
    res = get_onvif_camera_profiles(req.ip, req.port or 80, req.username, req.password)
    return res

@app.delete("/api/cameras/{camera_id}")
async def api_delete_camera(camera_id: str):
    recorder_manager.stop_recorder(camera_id)
    stream_manager.remove_camera_worker(camera_id)
    delete_camera(camera_id)
    return {"status": "ok", "message": f"Camera {camera_id} removed"}

# ── Vehicle ANPR & Whitelist API ─────────────────────────────────────────────
@app.get("/api/vehicles")
async def api_list_vehicles(search: Optional[str] = None):
    return list_vehicles(search=search)

@app.post("/api/vehicles")
async def api_add_vehicle(v: VehicleCreate):
    upsert_vehicle(v.model_dump())
    return {"status": "ok", "message": f"Vehicle {v.plate_number} saved"}

@app.delete("/api/vehicles/{plate_number}")
async def api_delete_vehicle(plate_number: str):
    delete_vehicle(plate_number)
    return {"status": "ok", "message": f"Vehicle {plate_number} deleted"}

@app.get("/api/logs/vehicles")
async def api_list_vehicle_logs(limit: int = 50):
    return list_vehicle_logs(limit=limit)

# ── Face Biometric Access Control API ────────────────────────────────────────
@app.get("/api/persons")
async def api_list_persons():
    return list_persons()

@app.post("/api/persons/enroll")
async def api_enroll_person(
    name: str = Form(...),
    employee_code: Optional[str] = Form(""),
    department: Optional[str] = Form(""),
    role: Optional[str] = Form("Employee"),
    access_status: str = Form("ALLOWED"),
    file: UploadFile = File(...)
):
    person_id = f"p_{uuid.uuid4().hex[:8]}"
    content = await file.read()

    embedding, photo_rel = face_engine.process_person_enrollment(content, person_id)
    if not photo_rel:
        raise HTTPException(status_code=400, detail="Could not process image or detect face")

    upsert_person({
        "id": person_id,
        "name": name,
        "employee_code": employee_code,
        "department": department,
        "role": role,
        "access_status": access_status,
        "embedding": json.dumps(embedding) if embedding else None,
        "photo_path": photo_rel
    })

    return {
        "status": "ok",
        "person_id": person_id,
        "name": name,
        "photo_path": photo_rel,
        "embedding_extracted": embedding is not None
    }

@app.delete("/api/persons/{person_id}")
async def api_delete_person(person_id: str):
    delete_person(person_id)
    return {"status": "ok", "message": f"Person {person_id} deleted"}

@app.get("/api/logs/faces")
async def api_list_face_logs(limit: int = 50):
    return list_face_logs(limit=limit)

# ── NVR Video Recordings API ─────────────────────────────────────────────────
@app.get("/api/recordings")
async def api_list_recordings(
    camera_id: Optional[str] = None,
    is_event: Optional[bool] = None,
    limit: int = 100
):
    return list_recordings(camera_id=camera_id, is_event=is_event, limit=limit)

# ── Storage & Janitor Stats API ──────────────────────────────────────────────
@app.get("/api/storage/stats")
async def api_storage_stats():
    return storage_janitor.get_storage_stats()

# ── Settings & Relay API ─────────────────────────────────────────────────────
@app.get("/api/settings")
async def api_get_settings():
    return {
        "retention_days": int(get_setting("retention_days", str(settings.RETENTION_DAYS))),
        "max_disk_usage_percent": float(get_setting("max_disk_usage_percent", str(settings.MAX_DISK_USAGE_PERCENT))),
        "face_similarity_threshold": float(get_setting("face_similarity_threshold", str(settings.FACE_SIMILARITY_THRESHOLD))),
        "relay_webhook_url": get_setting("relay_webhook_url", settings.GATE_RELAY_URL)
    }

@app.post("/api/settings")
async def api_update_settings(s: SystemSettingsUpdate):
    if s.retention_days is not None:
        set_setting("retention_days", str(s.retention_days))
    if s.max_disk_usage_percent is not None:
        set_setting("max_disk_usage_percent", str(s.max_disk_usage_percent))
    if s.face_similarity_threshold is not None:
        set_setting("face_similarity_threshold", str(s.face_similarity_threshold))
    if s.relay_webhook_url is not None:
        set_setting("relay_webhook_url", s.relay_webhook_url)
    return {"status": "ok", "message": "Settings updated"}

@app.post("/api/gate/open")
async def api_manual_open_gate(payload: dict):
    reason = payload.get("reason", "MANUAL_OVERRIDE")
    entity_id = payload.get("entity_id", "GUARD")
    access_controller.trigger_relay(reason, entity_id)
    return {"status": "ok", "action": "GATE_OPEN_TRIGGERED"}

# ── Event Simulator Endpoints ────────────────────────────────────────────────
@app.post("/api/simulate/plate")
async def api_simulate_plate(payload: dict):
    plate = payload.get("plate_number", "DL01AB1234")
    cam_id = payload.get("camera_id", "cam_01")
    frame = stream_manager.get_frame(cam_id)
    res = access_controller.process_plate_decision(plate, 0.95, cam_id, frame=frame)
    return res

@app.post("/api/simulate/face")
async def api_simulate_face(payload: dict):
    authorized = payload.get("authorized", True)
    cam_id = payload.get("camera_id", "cam_01")
    frame = stream_manager.get_frame(cam_id)

    # If testing authorized, query first enrolled person or seed dummy
    enrolled = list_persons()
    if authorized and enrolled:
        p = get_person(enrolled[0]["id"])
        emb = json.loads(p["embedding"]) if p and p["embedding"] else [0.1]*512
    elif authorized:
        # Seed dummy enrolled person if none
        dummy_emb = [0.05] * 512
        upsert_person({
            "id": "p_sample_ceo",
            "name": "Dr. Rohit Verma (CEO)",
            "employee_code": "DIR-001",
            "department": "Executive",
            "role": "Director",
            "access_status": "ALLOWED",
            "embedding": json.dumps(dummy_emb),
            "photo_path": "/static/img/avatar_placeholder.png"
        })
        emb = dummy_emb
    else:
        # Random vector for unknown stranger
        emb = np.random.uniform(-0.1, 0.1, 512).tolist()

    res = access_controller.process_face_decision(emb, cam_id, frame=frame)
    return res

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=False)
