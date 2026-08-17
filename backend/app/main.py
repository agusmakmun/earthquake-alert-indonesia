import json
import asyncio
import logging
from fastapi import FastAPI, HTTPException, Header, Query, Request, status
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import List, Optional
from datetime import datetime

from .config import LOCATION_LIMIT_PER_DEVICE
from .storage import Storage
from .schemas import (
    DeviceCreate, DeviceUpdate, DeviceResponse, 
    LocationCreate, LocationUpdate, LocationResponse, 
    EarthquakeResponse, MockEarthquakeTrigger
)
from .seed_data import PROVINCES, CITIES
from .worker import earthquake_cache, sse_queues, polling_worker_loop, process_new_earthquake, broadcast_push_notification

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

app = FastAPI(
    title="Earthquake Alert Indonesia API",
    description="API backend for monitoring BMKG earthquakes and sending location-relevant alerts.",
    version="1.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Background polling worker task startup/shutdown
polling_task = None

@app.on_event("startup")
async def startup_event():
    global polling_task
    # Load storage JSON data
    Storage.load_data()
    # Set worker main loop reference
    from . import worker
    worker.main_loop = asyncio.get_running_loop()
    # Start background polling worker
    polling_task = asyncio.create_task(polling_worker_loop())
    logger.info("FastAPI backend startup complete. Polling worker started.")

@app.on_event("shutdown")
async def shutdown_event():
    if polling_task:
        polling_task.cancel()
    logger.info("FastAPI backend shutdown complete.")

# 1. Device Endpoints
@app.post("/api/v1/devices", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
def register_device(device: DeviceCreate):
    device_dict = device.dict()
    saved = Storage.save_device(device_dict)
    return saved

@app.patch("/api/v1/devices/{installation_id}", response_model=DeviceResponse)
def update_device(installation_id: str, device_update: DeviceUpdate):
    device = Storage.get_device(installation_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found.")
    
    update_data = device_update.dict(exclude_unset=True)
    saved = Storage.save_device({**device, **update_data})
    return saved

# 2. Location Endpoints
@app.get("/api/v1/locations", response_model=List[LocationResponse])
def get_locations(x_installation_id: Optional[str] = Header(None, alias="X-Installation-Id")):
    if not x_installation_id:
        raise HTTPException(status_code=400, detail="X-Installation-Id header is required.")
    device = Storage.get_device(x_installation_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not registered.")
    return device["locations"]

@app.post("/api/v1/locations", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
def add_location(location: LocationCreate, x_installation_id: Optional[str] = Header(None, alias="X-Installation-Id")):
    if not x_installation_id:
        raise HTTPException(status_code=400, detail="X-Installation-Id header is required.")
    
    try:
        new_loc = Storage.add_location(x_installation_id, location.dict())
        if not new_loc:
            raise HTTPException(status_code=404, detail="Device not registered.")
        return new_loc
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.patch("/api/v1/locations/{location_id}", response_model=LocationResponse)
def update_location(
    location_id: int, 
    location_update: LocationUpdate, 
    x_installation_id: Optional[str] = Header(None, alias="X-Installation-Id")
):
    if not x_installation_id:
        raise HTTPException(status_code=400, detail="X-Installation-Id header is required.")
    
    updated = Storage.update_location(x_installation_id, location_id, location_update.dict(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Location or Device not found.")
    return updated

@app.delete("/api/v1/locations/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_location(location_id: int, x_installation_id: Optional[str] = Header(None, alias="X-Installation-Id")):
    if not x_installation_id:
        raise HTTPException(status_code=400, detail="X-Installation-Id header is required.")
    
    success = Storage.delete_location(x_installation_id, location_id)
    if not success:
        raise HTTPException(status_code=404, detail="Location or Device not found.")
    return

# 3. Earthquake Endpoints
@app.get("/api/v1/earthquakes/latest")
def get_latest_earthquakes():
    """Retrieve the cached latest, felt, and M5.0+ earthquakes."""
    return {
        "latest": earthquake_cache["latest"],
        "felt": earthquake_cache["felt"],
        "m5": earthquake_cache["m5"]
    }

@app.get("/api/v1/earthquakes/{id}", response_model=EarthquakeResponse)
def get_earthquake_detail(id: str):
    eq = earthquake_cache["all"].get(id)
    if not eq:
        raise HTTPException(status_code=404, detail="Earthquake event not found.")
    return eq

# 4. Regional Dropdowns (Provinces & Cities)
@app.get("/api/v1/regions")
def get_regions():
    """Returns lists of provinces and cities to feed the manual location selector dropdown."""
    return {
        "provinces": PROVINCES,
        "cities": CITIES
    }

# 4.5. Admin Dashboard Statistics
@app.get("/api/v1/admin/stats")
def get_admin_stats():
    """Returns stats about current devices, locations, and active SSE channels."""
    devices = Storage.get_devices()
    total_locations = sum(len(d.get("locations", [])) for d in devices)
    return {
        "sse_clients": len(sse_queues),
        "devices": len(devices),
        "locations": total_locations
    }

# 5. Server-Sent Events (SSE) stream for simulated push notifications
@app.get("/api/v1/stream")
async def sse_notifications_stream(request: Request):
    """
    SSE stream endpoint where connected web simulators listen for real-time 
    simulated push notifications dispatched by the background worker.
    """
    queue = asyncio.Queue()
    sse_queues.append(queue)
    logger.info(f"New simulator client subscribed to push notifications. Total: {len(sse_queues)}")
    
    async def event_generator():
        try:
            while True:
                # Keep-alive check
                if await request.is_disconnected():
                    break
                
                # Non-blocking wait for incoming push notification events
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=20.0)
                    yield f"event: {payload['event']}\ndata: {json.dumps(payload['data'])}\n\n"
                except asyncio.TimeoutError:
                    # Send keep-alive comment
                    yield ": keep-alive\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            sse_queues.remove(queue)
            logger.info(f"Simulator client disconnected. Total: {len(sse_queues)}")
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")

# 6. Mock earthquake injection (Developer admin tool)
@app.post("/api/v1/mock/trigger", status_code=status.HTTP_201_CREATED)
def trigger_mock_earthquake(trigger: MockEarthquakeTrigger):
    """
    Allows developers to inject a custom earthquake event into the system 
    to verify spatial alert engine rules and push notifications.
    """
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S+00:00")
    
    # Event ID is mock_ + timestamp
    event_id = f"mock_{int(datetime.utcnow().timestamp())}"
    
    mock_eq = {
        "bmkg_event_id": event_id,
        "event_time": timestamp,
        "latitude": trigger.latitude,
        "longitude": trigger.longitude,
        "magnitude": trigger.magnitude,
        "depth_km": trigger.depth_km,
        "location_description": trigger.location_description,
        "region": trigger.region,
        "tsunami_potential": trigger.tsunami_potential,
        "dirasakan": trigger.dirasakan,
        "shakemap_url": None,
        "raw_data": {"mock": True},
        "created_at": datetime.utcnow().isoformat()
    }
    
    # Put into global caches
    earthquake_cache["all"][event_id] = mock_eq
    earthquake_cache["latest"] = mock_eq
    
    # Prepend to felt list (maintain max 15 list size)
    earthquake_cache["felt"].insert(0, mock_eq)
    if len(earthquake_cache["felt"]) > 15:
        earthquake_cache["felt"] = earthquake_cache["felt"][:15]
        
    logger.info(f"Mock earthquake triggered: M {trigger.magnitude} in {trigger.region}")
    
    # Run alert engine to match against active devices and broadcast notifications
    process_new_earthquake(mock_eq)
    
    return {
        "status": "success",
        "message": f"Mock earthquake {event_id} triggered successfully",
        "event": mock_eq
    }

# 7. Mount web simulator assets at "/"
# StaticFiles will serve index.html by default when visiting the root.
try:
    app.mount("/", StaticFiles(directory="simulator", html=True), name="simulator")
except Exception as e:
    logger.error(f"Could not mount simulator directory: {e}. Create the simulator folder to fix.")
