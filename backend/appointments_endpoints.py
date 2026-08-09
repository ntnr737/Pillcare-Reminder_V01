
# ============================================================================
# APPOINTMENTS API - Complete booking system
# ============================================================================

@api.get("/appointments")
async def list_appointments(status: Optional[str] = None, limit: int = 100):
    """List all appointments, optionally filtered by status"""
    query = {}
    if status:
        query["status"] = status
    items = await db.appointments.find(query, PROJECTION).sort("date", 1).sort("time", 1).to_list(limit)
    return items


@api.post("/appointments")
async def create_appointment(payload: AppointmentCreate):
    """Create a new appointment"""
    appt = Appointment(
        doctor_name=payload.doctor_name,
        specialty=payload.specialty,
        phone=payload.phone,
        date=payload.date,
        time=payload.time,
        notes=payload.notes,
        reminder=payload.reminder or "1_day",
    )
    await db.appointments.insert_one(appt.dict())
    return appt


@api.get("/appointments/{appointment_id}")
async def get_appointment(appointment_id: str):
    """Get a specific appointment"""
    doc = await db.appointments.find_one({"id": appointment_id}, PROJECTION)
    if not doc:
        raise HTTPException(404, "Appointment not found")
    return doc


@api.patch("/appointments/{appointment_id}")
async def update_appointment(appointment_id: str, payload: AppointmentUpdate):
    """Update an appointment"""
    update = {k: v for k, v in payload.dict(exclude_unset=True).items() if v is not None}
    if not update:
        raise HTTPException(400, "No fields to update")

    res = await db.appointments.update_one({"id": appointment_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Appointment not found")

    doc = await db.appointments.find_one({"id": appointment_id}, PROJECTION)
    return doc


@api.delete("/appointments/{appointment_id}")
async def delete_appointment(appointment_id: str):
    """Delete an appointment"""
    res = await db.appointments.delete_one({"id": appointment_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Appointment not found")
    return {"ok": True}


# ============================================================================
# NEARBY PLACES API - Location-based services
# ============================================================================

@api.get("/places/nearby")
async def nearby_places(
    lat: float,
    lng: float,
    radius: int = 1000,
    place_type: str = "pharmacy"
):
    """
    Find nearby places (pharmacies, hospitals, diagnostic labs)

    Note: This is a mock implementation. For production, integrate with:
    - Google Places API
    - OpenStreetMap Overpass API
    - Mapbox Places API
    """
    # Mock data for development
    mock_places = [
        {
            "id": "place_1",
            "name": "Apollo Pharmacy",
            "type": "pharmacy",
            "address": "123 Main Street, Near City Center",
            "distance": 450,
            "phone": "+91-1234567890",
            "rating": 4.5,
            "open_now": True,
            "lat": lat + 0.004,
            "lng": lng + 0.003,
        },
        {
            "id": "place_2",
            "name": "City Hospital",
            "type": "hospital",
            "address": "456 Health Avenue",
            "distance": 850,
            "phone": "+91-0987654321",
            "rating": 4.2,
            "open_now": True,
            "lat": lat - 0.006,
            "lng": lng + 0.005,
        },
        {
            "id": "place_3",
            "name": "MedPlus Pharmacy",
            "type": "pharmacy",
            "address": "789 Market Road",
            "distance": 1200,
            "phone": "+91-1122334455",
            "rating": 4.7,
            "open_now": True,
            "lat": lat + 0.008,
            "lng": lng - 0.007,
        },
        {
            "id": "place_4",
            "name": "PathLab Diagnostics",
            "type": "diagnostic_lab",
            "address": "321 Medical Plaza",
            "distance": 650,
            "phone": "+91-5566778899",
            "rating": 4.3,
            "open_now": False,
            "lat": lat - 0.005,
            "lng": lng - 0.004,
        },
    ]

    # Filter by type and radius
    filtered = [
        p for p in mock_places
        if (place_type == "all" or p["type"] == place_type) and p["distance"] <= radius
    ]

    # Sort by distance
    filtered.sort(key=lambda x: x["distance"])

    logger.info(f"Nearby places query: lat={lat}, lng={lng}, radius={radius}m, type={place_type}, found={len(filtered)}")

    return {
        "places": filtered,
        "count": len(filtered),
        "search_radius": radius,
        "center": {"lat": lat, "lng": lng},
    }


@api.get("/places/types")
async def place_types():
    """Get available place types"""
    return {
        "types": [
            {"key": "pharmacy", "label": "Pharmacies", "icon": "medical"},
            {"key": "hospital", "label": "Hospitals & Clinics", "icon": "fitness"},
            {"key": "diagnostic_lab", "label": "Diagnostic Labs", "icon": "flask"},
            {"key": "all", "label": "All Places", "icon": "location"},
        ]
    }
