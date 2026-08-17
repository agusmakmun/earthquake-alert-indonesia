import os
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional

logger = logging.getLogger("storage")

STORAGE_FILE = os.getenv("STORAGE_FILE_PATH", "devices.json")

# In-memory database structure
_db = {
    "devices": {},          # installation_id -> device_dict
    "notification_logs": [] # list of notified events
}

def load_data():
    global _db
    if os.path.exists(STORAGE_FILE):
        try:
            with open(STORAGE_FILE, "r") as f:
                data = json.load(f)
                _db["devices"] = data.get("devices", {})
                _db["notification_logs"] = data.get("notification_logs", [])
                logger.info(f"Loaded storage data. Devices count: {len(_db['devices'])}")
        except Exception as e:
            logger.error(f"Error loading storage file: {e}")
            # Fallback to empty if corrupted
            _db = {"devices": {}, "notification_logs": []}
    else:
        save_data()

def save_data():
    try:
        # Atomic write
        temp_file = STORAGE_FILE + ".tmp"
        with open(temp_file, "w") as f:
            json.dump(_db, f, indent=2)
        os.replace(temp_file, STORAGE_FILE)
    except Exception as e:
        logger.error(f"Error saving storage file: {e}")

# Initialize on import
load_data()

class Storage:
    @staticmethod
    def load_data():
        load_data()

    @staticmethod
    def get_devices() -> List[dict]:
        return list(_db["devices"].values())

    @staticmethod
    def get_device(installation_id: str) -> Optional[dict]:
        return _db["devices"].get(installation_id)

    @staticmethod
    def save_device(device_data: dict) -> dict:
        inst_id = device_data["installation_id"]
        now_str = datetime.utcnow().isoformat()
        
        existing = _db["devices"].get(inst_id)
        if existing:
            # Update
            existing.update(device_data)
            existing["updated_at"] = now_str
            existing["last_seen_at"] = now_str
            device_data = existing
        else:
            # Create new
            device_data["created_at"] = now_str
            device_data["updated_at"] = now_str
            device_data["last_seen_at"] = now_str
            device_data["locations"] = device_data.get("locations", [])
            _db["devices"][inst_id] = device_data
            
        save_data()
        return device_data

    @staticmethod
    def get_locations(installation_id: str) -> List[dict]:
        device = Storage.get_device(installation_id)
        return device.get("locations", []) if device else []

    @staticmethod
    def add_location(installation_id: str, location_data: dict) -> Optional[dict]:
        device = Storage.get_device(installation_id)
        if not device:
            return None
        
        # Limit checking (max 5)
        from .config import LOCATION_LIMIT_PER_DEVICE
        if len(device["locations"]) >= LOCATION_LIMIT_PER_DEVICE:
            raise ValueError(f"Limit of {LOCATION_LIMIT_PER_DEVICE} monitoring locations reached.")
            
        # Auto-increment local ID
        next_id = 1
        if device["locations"]:
            next_id = max(loc["id"] for loc in device["locations"]) + 1
            
        now_str = datetime.utcnow().isoformat()
        new_loc = {
            "id": next_id,
            "name": location_data["name"],
            "type": location_data["type"],
            "latitude": location_data["latitude"],
            "longitude": location_data["longitude"],
            "province_id": location_data.get("province_id"),
            "city_id": location_data.get("city_id"),
            "enabled": location_data.get("enabled", True),
            "created_at": now_str,
            "updated_at": now_str
        }
        
        device["locations"].append(new_loc)
        device["updated_at"] = now_str
        save_data()
        return new_loc

    @staticmethod
    def update_location(installation_id: str, location_id: int, updates: dict) -> Optional[dict]:
        device = Storage.get_device(installation_id)
        if not device:
            return None
            
        for loc in device["locations"]:
            if loc["id"] == location_id:
                loc.update({k: v for k, v in updates.items() if v is not None})
                loc["updated_at"] = datetime.utcnow().isoformat()
                device["updated_at"] = datetime.utcnow().isoformat()
                save_data()
                return loc
        return None

    @staticmethod
    def delete_location(installation_id: str, location_id: int) -> bool:
        device = Storage.get_device(installation_id)
        if not device:
            return False
            
        initial_count = len(device["locations"])
        device["locations"] = [loc for loc in device["locations"] if loc["id"] != location_id]
        
        if len(device["locations"]) != initial_count:
            device["updated_at"] = datetime.utcnow().isoformat()
            save_data()
            return True
        return False

    @staticmethod
    def check_duplicate_notification(earthquake_id: str, installation_id: str, location_id: int) -> bool:
        for log in _db["notification_logs"]:
            if (log["earthquake_id"] == earthquake_id and 
                log["installation_id"] == installation_id and 
                log["location_id"] == location_id):
                return True
        return False

    @staticmethod
    def log_notification(earthquake_id: str, installation_id: str, location_id: int, severity: str):
        log = {
            "earthquake_id": earthquake_id,
            "installation_id": installation_id,
            "location_id": location_id,
            "severity": severity,
            "sent_at": datetime.utcnow().isoformat()
        }
        _db["notification_logs"].append(log)
        # Cap log size to prevent infinite growth
        if len(_db["notification_logs"]) > 5000:
            _db["notification_logs"] = _db["notification_logs"][-5000:]
        save_data()
