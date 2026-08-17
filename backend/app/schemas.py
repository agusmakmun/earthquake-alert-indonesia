from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class DeviceCreate(BaseModel):
    installation_id: str
    platform: str
    app_version: Optional[str] = None
    os_version: Optional[str] = None

class DeviceUpdate(BaseModel):
    push_token: Optional[str] = None
    app_version: Optional[str] = None
    os_version: Optional[str] = None

class DeviceResponse(BaseModel):
    id: Optional[int] = None
    installation_id: str
    platform: str
    push_token: Optional[str] = None
    app_version: Optional[str] = None
    os_version: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    last_seen_at: datetime

    class Config:
        from_attributes = True

class LocationCreate(BaseModel):
    name: str
    type: str # "current_location", "province", "city", "regency"
    latitude: float
    longitude: float
    province_id: Optional[int] = None
    city_id: Optional[int] = None
    regency_id: Optional[int] = None

class LocationUpdate(BaseModel):
    name: Optional[str] = None
    enabled: Optional[bool] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class LocationResponse(BaseModel):
    id: int
    device_id: Optional[str] = None
    name: str
    type: str
    latitude: float
    longitude: float
    enabled: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class EarthquakeResponse(BaseModel):
    id: Optional[int] = None
    bmkg_event_id: str
    event_time: datetime
    latitude: float
    longitude: float
    magnitude: float
    depth_km: float
    location_description: Optional[str] = None
    region: Optional[str] = None
    tsunami_potential: Optional[str] = None
    dirasakan: Optional[str] = None
    shakemap_url: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class MockEarthquakeTrigger(BaseModel):
    magnitude: float
    depth_km: float
    latitude: float
    longitude: float
    location_description: str
    region: str
    tsunami_potential: Optional[str] = "Tidak berpotensi"
    dirasakan: Optional[str] = None
