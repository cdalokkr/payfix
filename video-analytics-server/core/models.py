from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class CameraCreate(BaseModel):
    id: str = Field(..., description="Unique camera ID (e.g. cam_01)")
    name: str = Field(..., description="Human readable name (e.g. Main Gate Entry)")
    stream_url: str = Field(..., description="RTSP or video stream URL")
    substream_url: Optional[str] = Field(None, description="Optional low-res substream URL for analytics")
    location: Optional[str] = Field("Main Gate", description="Physical location")
    purpose: Optional[str] = Field("entry_gate", description="Purpose: entry_gate, exit_gate, surveillance")
    is_active: Optional[bool] = True
    recording_enabled: Optional[bool] = True

class CameraUpdate(BaseModel):
    name: Optional[str] = None
    stream_url: Optional[str] = None
    substream_url: Optional[str] = None
    location: Optional[str] = None
    purpose: Optional[str] = None
    is_active: Optional[bool] = None
    recording_enabled: Optional[bool] = None

class StreamTestRequest(BaseModel):
    stream_url: str

class OnvifProfilesRequest(BaseModel):
    ip: str
    port: Optional[int] = 80
    username: str
    password: str

class VehicleCreate(BaseModel):
    plate_number: str = Field(..., description="Vehicle license plate number (e.g. DL01AB1234)")
    owner_name: str = Field(..., description="Owner or driver name")
    vehicle_type: Optional[str] = Field("Car", description="Vehicle type: Car, Bike, Truck, etc.")
    access_status: str = Field("ALLOWED", description="Access status: ALLOWED, BLOCKED, VISITOR")
    notes: Optional[str] = Field("", description="Additional notes")

class PersonCreate(BaseModel):
    id: Optional[str] = None
    name: str = Field(..., description="Full name of person")
    employee_code: Optional[str] = Field("", description="Employee or member ID")
    department: Optional[str] = Field("", description="Department or company")
    role: Optional[str] = Field("Employee", description="Role: Employee, Manager, VIP, Contractor")
    access_status: str = Field("ALLOWED", description="Access status: ALLOWED, BLOCKED, VISITOR")
    photo_base64: Optional[str] = Field(None, description="Base64 encoded JPEG/PNG for face enrollment")

class ManualPlateCheck(BaseModel):
    plate_number: str
    camera_id: Optional[str] = "manual"

class ManualFaceCheck(BaseModel):
    image_base64: str
    camera_id: Optional[str] = "manual"

class SystemSettingsUpdate(BaseModel):
    retention_days: Optional[int] = None
    max_disk_usage_percent: Optional[float] = None
    face_similarity_threshold: Optional[float] = None
    relay_webhook_url: Optional[str] = None
