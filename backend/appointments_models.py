"""
Appointments API - Complete booking system
"""
from typing import Optional
from datetime import datetime, timezone

# Appointment model (add to server.py models section)
class Appointment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    doctor_name: str
    specialty: str
    phone: str
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
    notes: Optional[str] = None
    reminder: Optional[str] = None  # "1_day", "2_hours", "none"
    status: str = "scheduled"  # scheduled, completed, cancelled
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AppointmentCreate(BaseModel):
    doctor_name: str
    specialty: str
    phone: str
    date: str
    time: str
    notes: Optional[str] = None
    reminder: Optional[str] = "1_day"


class AppointmentUpdate(BaseModel):
    doctor_name: Optional[str] = None
    specialty: Optional[str] = None
    phone: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    notes: Optional[str] = None
    reminder: Optional[str] = None
    status: Optional[str] = None
