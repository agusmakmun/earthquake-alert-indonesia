import re
import math
import logging
from datetime import datetime
from typing import List, Dict, Tuple
from .storage import Storage

logger = logging.getLogger("alert_engine")

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees) in kilometers.
    """
    R = 6371.0 # Earth radius in km
    
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 + 
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def normalize_text(text_val: str) -> str:
    """Normalize regional text by converting to lowercase and stripping prefixes."""
    if not text_val:
        return ""
    val = text_val.lower()
    for prefix in ["kabupaten ", "kab. ", "kota ", "provinsi ", "prov. "]:
        val = val.replace(prefix, "")
    return val.strip()

def check_felt_area_match(location_name: str, felt_areas_str: str) -> bool:
    """
    Check if the location name is listed in the felt areas string.
    e.g. location_name="Kabupaten Sukabumi" and felt_areas_str="III Sukabumi, II Cianjur" -> True.
    """
    if not felt_areas_str:
        return False
    
    norm_loc = normalize_text(location_name)
    norm_felt = felt_areas_str.lower() # Preserve string for part parsing
    
    # Split felt areas by comma to avoid partial matches
    felt_parts = [part.strip() for part in norm_felt.split(",")]
    
    for part in felt_parts:
        # Strip MMI Roman numeral prefixes (e.g. "iii ", "iii-iv ", "iv-v ")
        cleaned_part = re.sub(r'^[ivx]+(?:-[ivx]+)?\s+', '', part).strip()
        
        # Normalize the region part
        cleaned_part = normalize_text(cleaned_part)
        
        if cleaned_part and (cleaned_part in norm_loc or norm_loc in cleaned_part):
            return True
            
    return False

def get_alert_distance_threshold(magnitude: float) -> float:
    """
    Determine the alerting radius threshold in kilometers based on magnitude.
    """
    if magnitude >= 6.0:
        return 500.0
    elif magnitude >= 5.0:
        return 250.0
    elif magnitude >= 4.0:
        return 100.0
    elif magnitude >= 3.0:
        return 50.0
    return 0.0

def evaluate_alert(earthquake: dict, location: dict) -> Tuple[bool, str]:
    """
    Determine if an earthquake is relevant to a specific monitoring location.
    Returns (should_alert, severity).
    """
    magnitude = float(earthquake.get("magnitude", 0))
    tsunami_potential = earthquake.get("tsunami_potential", "")
    is_tsunami = tsunami_potential and "tsunami" in tsunami_potential.lower()
    
    # Severity mapping
    if magnitude >= 6.0 or is_tsunami:
        severity = "CRITICAL"
    elif magnitude >= 4.0:
        severity = "WARNING"
    else:
        severity = "INFO"

    # Priority 1: Check felt area matching
    dirasakan = earthquake.get("dirasakan")
    if dirasakan:
        if check_felt_area_match(location["name"], dirasakan):
            logger.info(f"Match found: Location '{location['name']}' matched BMKG felt area list: '{dirasakan}'")
            return True, severity

    # Priority 3: Check distance-based matching
    distance = haversine_distance(
        float(earthquake["latitude"]), float(earthquake["longitude"]),
        float(location["latitude"]), float(location["longitude"])
    )
    
    threshold = get_alert_distance_threshold(magnitude)
    
    if distance <= threshold:
        logger.info(f"Match found: Location '{location['name']}' is {distance:.1f} km from epicenter (threshold {threshold} km)")
        # Alert only on WARNING and CRITICAL (magnitude >= 4.0 or tsunami) to avoid spamming small events
        if severity in ["WARNING", "CRITICAL"]:
            return True, severity

    return False, severity

def run_alert_engine(earthquake: dict) -> List[dict]:
    """
    Runs the alert engine for a new/updated earthquake.
    Finds all active monitoring locations matching the rules, 
    performs deduplication, and returns list of alerts to send.
    """
    devices = Storage.get_devices()
    triggered_alerts = []
    
    eq_id = earthquake["bmkg_event_id"]
    
    for dev in devices:
        inst_id = dev["installation_id"]
        push_token = dev.get("push_token")
        
        for loc in dev.get("locations", []):
            if not loc.get("enabled", True):
                continue
                
            should_alert, severity = evaluate_alert(earthquake, loc)
            if not should_alert:
                continue
                
            # Deduplication
            if Storage.check_duplicate_notification(eq_id, inst_id, loc["id"]):
                continue
                
            # Log notification to prevent duplicate alerts
            Storage.log_notification(eq_id, inst_id, loc["id"], severity)
            
            triggered_alerts.append({
                "installation_id": inst_id,
                "push_token": push_token,
                "platform": dev["platform"],
                "location_name": loc["name"],
                "location_type": loc["type"],
                "severity": severity,
                "earthquake": earthquake
            })
            
    return triggered_alerts
