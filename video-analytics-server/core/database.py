import sqlite3
import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from contextlib import contextmanager
from core.config import settings

logger = logging.getLogger("video_analytics.database")

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.DB_PATH, check_same_thread=False, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn

@contextmanager
def db_session():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    with db_session() as conn:
        cursor = conn.cursor()

        # 1. Cameras
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS cameras (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            stream_url TEXT NOT NULL,
            substream_url TEXT,
            location TEXT DEFAULT 'Main Gate',
            purpose TEXT DEFAULT 'entry_gate',
            is_active INTEGER DEFAULT 1,
            recording_enabled INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 2. Vehicles (Whitelist / Blacklist)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS vehicles (
            plate_number TEXT PRIMARY KEY,
            owner_name TEXT NOT NULL,
            vehicle_type TEXT DEFAULT 'Car',
            access_status TEXT DEFAULT 'ALLOWED',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 3. Vehicle Entry Logs
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS vehicle_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            camera_id TEXT,
            plate_number TEXT NOT NULL,
            owner_name TEXT,
            access_status TEXT NOT NULL,
            confidence REAL DEFAULT 0.0,
            snapshot_path TEXT,
            event_clip_path TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_vlogs_plate ON vehicle_logs(plate_number);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_vlogs_time ON vehicle_logs(timestamp);")

        # 4. Persons (Face Biometric Directory)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS persons (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            employee_code TEXT,
            department TEXT,
            role TEXT DEFAULT 'Employee',
            access_status TEXT DEFAULT 'ALLOWED',
            embedding TEXT,
            photo_path TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 5. Face Access Logs
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS face_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            camera_id TEXT,
            person_id TEXT,
            person_name TEXT NOT NULL,
            similarity REAL DEFAULT 0.0,
            access_status TEXT NOT NULL,
            snapshot_path TEXT,
            event_clip_path TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_flogs_person ON face_logs(person_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_flogs_time ON face_logs(timestamp);")

        # 6. Video Recordings Index (NVR)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS recordings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            camera_id TEXT NOT NULL,
            file_path TEXT UNIQUE NOT NULL,
            start_time TIMESTAMP NOT NULL,
            end_time TIMESTAMP NOT NULL,
            duration_sec REAL DEFAULT 0.0,
            file_size_mb REAL DEFAULT 0.0,
            is_event_clip INTEGER DEFAULT 0,
            event_type TEXT DEFAULT 'continuous',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_recordings_cam ON recordings(camera_id, start_time);")

        # 7. System Settings
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS system_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        """)

        # Default settings if not exist
        defaults = {
            "retention_days": str(settings.RETENTION_DAYS),
            "max_disk_usage_percent": str(settings.MAX_DISK_USAGE_PERCENT),
            "face_similarity_threshold": str(settings.FACE_SIMILARITY_THRESHOLD),
            "relay_webhook_url": settings.GATE_RELAY_URL
        }
        for k, v in defaults.items():
            cursor.execute("INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?);", (k, v))

        # Seed default sample camera if empty
        cursor.execute("SELECT COUNT(*) FROM cameras;")
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
            INSERT INTO cameras (id, name, stream_url, location, purpose, is_active, recording_enabled)
            VALUES ('cam_01', 'Entry Gate Camera', 'simulated://entry_gate', 'Main Gate', 'entry_gate', 1, 1);
            """)

        # Seed default sample whitelist vehicle
        cursor.execute("SELECT COUNT(*) FROM vehicles;")
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
            INSERT INTO vehicles (plate_number, owner_name, vehicle_type, access_status, notes)
            VALUES 
                ('DL01AB1234', 'Company Director', 'Car', 'ALLOWED', 'Executive Parking'),
                ('HR26DQ5678', 'Chief Engineer', 'Car', 'ALLOWED', 'Staff Gate'),
                ('UP16XX9999', 'Blacklisted Intruder', 'Car', 'BLOCKED', 'Security Alert: Do Not Admit');
            """)

    logger.info("Database initialized successfully.")

# ── CRUD Operations ──────────────────────────────────────────────────────────

def list_cameras() -> List[Dict[str, Any]]:
    with db_session() as conn:
        rows = conn.execute("SELECT * FROM cameras ORDER BY created_at DESC;").fetchall()
        return [dict(r) for r in rows]

def get_camera(camera_id: str) -> Optional[Dict[str, Any]]:
    with db_session() as conn:
        row = conn.execute("SELECT * FROM cameras WHERE id = ?;", (camera_id,)).fetchone()
        return dict(row) if row else None

def add_camera(camera_data: Dict[str, Any]):
    with db_session() as conn:
        conn.execute("""
        INSERT INTO cameras (id, name, stream_url, substream_url, location, purpose, is_active, recording_enabled)
        VALUES (:id, :name, :stream_url, :substream_url, :location, :purpose, :is_active, :recording_enabled)
        ON CONFLICT(id) DO UPDATE SET
            name = :name,
            stream_url = :stream_url,
            substream_url = :substream_url,
            location = :location,
            purpose = :purpose,
            is_active = :is_active,
            recording_enabled = :recording_enabled;
        """, camera_data)

def update_camera(camera_id: str, updates: Dict[str, Any]):
    with db_session() as conn:
        fields = []
        values = []
        for k, v in updates.items():
            if v is not None:
                fields.append(f"{k} = ?")
                values.append(v)
        if fields:
            values.append(camera_id)
            query = f"UPDATE cameras SET {', '.join(fields)} WHERE id = ?;"
            conn.execute(query, values)

def delete_camera(camera_id: str):
    with db_session() as conn:
        conn.execute("DELETE FROM cameras WHERE id = ?;", (camera_id,))

def list_vehicles(search: Optional[str] = None) -> List[Dict[str, Any]]:
    with db_session() as conn:
        if search:
            query = "SELECT * FROM vehicles WHERE plate_number LIKE ? OR owner_name LIKE ? ORDER BY created_at DESC;"
            rows = conn.execute(query, (f"%{search}%", f"%{search}%")).fetchall()
        else:
            rows = conn.execute("SELECT * FROM vehicles ORDER BY created_at DESC;").fetchall()
        return [dict(r) for r in rows]

def get_vehicle(plate_number: str) -> Optional[Dict[str, Any]]:
    clean = plate_number.strip().upper().replace(" ", "").replace("-", "")
    with db_session() as conn:
        rows = conn.execute("SELECT * FROM vehicles;").fetchall()
        for r in rows:
            stored_clean = r["plate_number"].strip().upper().replace(" ", "").replace("-", "")
            if stored_clean == clean:
                return dict(r)
        return None

def upsert_vehicle(vehicle_data: Dict[str, Any]):
    clean_plate = vehicle_data["plate_number"].strip().upper().replace(" ", "").replace("-", "")
    vehicle_data["plate_number"] = clean_plate
    with db_session() as conn:
        conn.execute("""
        INSERT INTO vehicles (plate_number, owner_name, vehicle_type, access_status, notes)
        VALUES (:plate_number, :owner_name, :vehicle_type, :access_status, :notes)
        ON CONFLICT(plate_number) DO UPDATE SET
            owner_name = :owner_name,
            vehicle_type = :vehicle_type,
            access_status = :access_status,
            notes = :notes;
        """, vehicle_data)

def delete_vehicle(plate_number: str):
    with db_session() as conn:
        conn.execute("DELETE FROM vehicles WHERE plate_number = ?;", (plate_number,))

def log_vehicle_event(log_data: Dict[str, Any]) -> int:
    with db_session() as conn:
        cur = conn.execute("""
        INSERT INTO vehicle_logs (camera_id, plate_number, owner_name, access_status, confidence, snapshot_path, event_clip_path)
        VALUES (:camera_id, :plate_number, :owner_name, :access_status, :confidence, :snapshot_path, :event_clip_path);
        """, log_data)
        return cur.lastrowid

def list_vehicle_logs(limit: int = 50) -> List[Dict[str, Any]]:
    with db_session() as conn:
        rows = conn.execute("SELECT * FROM vehicle_logs ORDER BY id DESC LIMIT ?;", (limit,)).fetchall()
        return [dict(r) for r in rows]

def list_persons() -> List[Dict[str, Any]]:
    with db_session() as conn:
        rows = conn.execute("SELECT id, name, employee_code, department, role, access_status, photo_path, created_at FROM persons ORDER BY created_at DESC;").fetchall()
        return [dict(r) for r in rows]

def get_person(person_id: str) -> Optional[Dict[str, Any]]:
    with db_session() as conn:
        row = conn.execute("SELECT * FROM persons WHERE id = ?;", (person_id,)).fetchone()
        return dict(row) if row else None

def get_all_person_embeddings() -> List[Dict[str, Any]]:
    with db_session() as conn:
        rows = conn.execute("SELECT id, name, access_status, embedding FROM persons WHERE embedding IS NOT NULL;").fetchall()
        res = []
        for r in rows:
            try:
                emb = json.loads(r["embedding"]) if r["embedding"] else None
                if emb:
                    res.append({
                        "id": r["id"],
                        "name": r["name"],
                        "access_status": r["access_status"],
                        "embedding": emb
                    })
            except Exception:
                pass
        return res

def upsert_person(person_data: Dict[str, Any]):
    with db_session() as conn:
        conn.execute("""
        INSERT INTO persons (id, name, employee_code, department, role, access_status, embedding, photo_path)
        VALUES (:id, :name, :employee_code, :department, :role, :access_status, :embedding, :photo_path)
        ON CONFLICT(id) DO UPDATE SET
            name = :name,
            employee_code = :employee_code,
            department = :department,
            role = :role,
            access_status = :access_status,
            embedding = COALESCE(:embedding, persons.embedding),
            photo_path = COALESCE(:photo_path, persons.photo_path);
        """, person_data)

def delete_person(person_id: str):
    with db_session() as conn:
        conn.execute("DELETE FROM persons WHERE id = ?;", (person_id,))

def log_face_event(log_data: Dict[str, Any]) -> int:
    with db_session() as conn:
        cur = conn.execute("""
        INSERT INTO face_logs (camera_id, person_id, person_name, similarity, access_status, snapshot_path, event_clip_path)
        VALUES (:camera_id, :person_id, :person_name, :similarity, :access_status, :snapshot_path, :event_clip_path);
        """, log_data)
        return cur.lastrowid

def list_face_logs(limit: int = 50) -> List[Dict[str, Any]]:
    with db_session() as conn:
        rows = conn.execute("SELECT * FROM face_logs ORDER BY id DESC LIMIT ?;", (limit,)).fetchall()
        return [dict(r) for r in rows]

def add_recording(rec_data: Dict[str, Any]):
    with db_session() as conn:
        conn.execute("""
        INSERT INTO recordings (camera_id, file_path, start_time, end_time, duration_sec, file_size_mb, is_event_clip, event_type)
        VALUES (:camera_id, :file_path, :start_time, :end_time, :duration_sec, :file_size_mb, :is_event_clip, :event_type)
        ON CONFLICT(file_path) DO UPDATE SET
            end_time = :end_time,
            duration_sec = :duration_sec,
            file_size_mb = :file_size_mb;
        """, rec_data)

def list_recordings(camera_id: Optional[str] = None, is_event: Optional[bool] = None, limit: int = 100) -> List[Dict[str, Any]]:
    with db_session() as conn:
        query = "SELECT * FROM recordings WHERE 1=1"
        params = []
        if camera_id:
            query += " AND camera_id = ?"
            params.append(camera_id)
        if is_event is not None:
            query += " AND is_event_clip = ?"
            params.append(1 if is_event else 0)
        query += " ORDER BY start_time DESC LIMIT ?"
        params.append(limit)
        rows = conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]

def get_oldest_recordings(limit: int = 20) -> List[Dict[str, Any]]:
    with db_session() as conn:
        rows = conn.execute("SELECT * FROM recordings WHERE is_event_clip = 0 ORDER BY start_time ASC LIMIT ?;", (limit,)).fetchall()
        return [dict(r) for r in rows]

def delete_recording(recording_id: int):
    with db_session() as conn:
        conn.execute("DELETE FROM recordings WHERE id = ?;", (recording_id,))

def get_setting(key: str, default: str = "") -> str:
    with db_session() as conn:
        row = conn.execute("SELECT value FROM system_settings WHERE key = ?;", (key,)).fetchone()
        return row["value"] if row else default

def set_setting(key: str, value: str):
    with db_session() as conn:
        conn.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?);", (key, value))
