import time
import requests
import logging
import asyncio
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from .config import BMKG_AUTO_GEMPA_URL, BMKG_GEMPA_DIRASAKAN_URL, BMKG_GEMPA_TERKINI_URL, POLL_INTERVAL_SECONDS
from .alert_engine import run_alert_engine

logger = logging.getLogger("worker")

# In-memory cache for latest earthquakes
# We keep the latest autogempa (M5.0+ or newest) and the list of 15 felt earthquakes.
earthquake_cache = {
    "latest": None,     # Latest single auto-gempa
    "felt": [],        # List of 15 felt gempas
    "m5": [],          # List of 15 M5.0+ gempas
    "all": {}          # Map of bmkg_event_id -> normalized_eq_dict
}

# SSE subscription queues
sse_queues = []
main_loop = None

def parse_bmkg_coords(coordinates_str: str) -> Tuple[float, float]:
    """Parse comma-separated coords, e.g. '-4.27,139.28' -> (-4.27, 139.28)"""
    try:
        parts = coordinates_str.split(",")
        return float(parts[0]), float(parts[1])
    except Exception:
        return 0.0, 0.0

def parse_depth(depth_str: str) -> float:
    """Parse depth string like '91 km' or '10 Km' -> 91.0"""
    try:
        clean = "".join(c for c in depth_str if c.isdigit() or c == ".")
        return float(clean)
    except Exception:
        return 0.0

def normalize_eq_data(raw_gempa: dict) -> dict:
    """Normalize raw BMKG JSON gempa record to our standard model."""
    date_time_str = raw_gempa.get("DateTime")
    coords_str = raw_gempa.get("Coordinates", "")
    lat, lng = parse_bmkg_coords(coords_str)
    
    # Event ID is the DateTime string (unique to each event in BMKG)
    event_id = date_time_str if date_time_str else f"eq_{raw_gempa.get('Tanggal')}_{raw_gempa.get('Jam')}"
    
    shakemap = raw_gempa.get("Shakemap")
    shakemap_url = f"https://static.bmkg.go.id/{shakemap}" if shakemap and shakemap != "-" else None
    
    # Try to extract region from Wilayah (usually after "km ...")
    wilayah = raw_gempa.get("Wilayah", "")
    region = wilayah
    if " dari " in wilayah:
        region = wilayah.split(" dari ")[-1]
    elif " km " in wilayah:
        # e.g., "Pusat gempa berada di darat 42 km tenggara Wamena" -> Wamena
        parts = wilayah.split(" ")
        if len(parts) > 2:
            region = " ".join(parts[parts.index("km")+3:]) if "km" in parts else wilayah
            
    return {
        "bmkg_event_id": event_id,
        "event_time": date_time_str or datetime.utcnow().isoformat(),
        "latitude": lat,
        "longitude": lng,
        "magnitude": float(raw_gempa.get("Magnitude", 0)),
        "depth_km": parse_depth(raw_gempa.get("Kedalaman", "0")),
        "location_description": wilayah,
        "region": region.strip(),
        "tsunami_potential": raw_gempa.get("Potensi", "Tidak berpotensi"),
        "dirasakan": raw_gempa.get("Dirasakan"),
        "shakemap_url": shakemap_url,
        "raw_data": raw_gempa,
        "created_at": datetime.utcnow().isoformat()
    }

def fetch_latest_earthquakes():
    """Poll BMKG API feeds and update the caches."""
    global earthquake_cache
    
    # 1. Fetch autogempa (latest)
    try:
        resp = requests.get(BMKG_AUTO_GEMPA_URL, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            raw_gempa = data.get("Infogempa", {}).get("gempa")
            if raw_gempa:
                normalized = normalize_eq_data(raw_gempa)
                eq_id = normalized["bmkg_event_id"]
                
                # Check if it is a new event
                is_new = eq_id not in earthquake_cache["all"]
                earthquake_cache["all"][eq_id] = normalized
                earthquake_cache["latest"] = normalized
                
                if is_new:
                    logger.info(f"New auto-gempa detected: M {normalized['magnitude']} in {normalized['region']}")
                    process_new_earthquake(normalized)
        else:
            logger.warning(f"Failed to fetch autogempa from BMKG. Status: {resp.status_code}")
    except Exception as e:
        logger.error(f"Error fetching autogempa: {e}")

    # 2. Fetch gempadirasakan (15 felt gempas)
    try:
        resp = requests.get(BMKG_GEMPA_DIRASAKAN_URL, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            raw_list = data.get("Infogempa", {}).get("gempa", [])
            if isinstance(raw_list, dict):  # In case BMKG returns a single dict instead of list
                raw_list = [raw_list]
                
            normalized_list = []
            for item in raw_list:
                normalized = normalize_eq_data(item)
                eq_id = normalized["bmkg_event_id"]
                
                is_new = eq_id not in earthquake_cache["all"]
                earthquake_cache["all"][eq_id] = normalized
                normalized_list.append(normalized)
                
                if is_new:
                    logger.info(f"New felt-gempa detected: M {normalized['magnitude']} felt in {normalized['dirasakan']}")
                    process_new_earthquake(normalized)
                    
            earthquake_cache["felt"] = normalized_list
        else:
            logger.warning(f"Failed to fetch gempadirasakan from BMKG. Status: {resp.status_code}")
    except Exception as e:
        logger.error(f"Error fetching gempadirasakan: {e}")

    # 3. Fetch gempaterkini (15 M5.0+ gempas)
    try:
        resp = requests.get(BMKG_GEMPA_TERKINI_URL, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            raw_list = data.get("Infogempa", {}).get("gempa", [])
            if isinstance(raw_list, dict):
                raw_list = [raw_list]
                
            normalized_list = []
            for item in raw_list:
                normalized = normalize_eq_data(item)
                eq_id = normalized["bmkg_event_id"]
                
                is_new = eq_id not in earthquake_cache["all"]
                earthquake_cache["all"][eq_id] = normalized
                normalized_list.append(normalized)
                
                if is_new:
                    logger.info(f"New M5.0+ gempa detected: M {normalized['magnitude']} in {normalized['region']}")
                    process_new_earthquake(normalized)
                    
            earthquake_cache["m5"] = normalized_list
        else:
            logger.warning(f"Failed to fetch gempaterkini from BMKG. Status: {resp.status_code}")
    except Exception as e:
        logger.error(f"Error fetching gempaterkini: {e}")

def process_new_earthquake(earthquake: dict):
    """Run alert engine and broadcast notifications via SSE to connected clients."""
    alerts = run_alert_engine(earthquake)
    if not alerts:
        return
        
    logger.info(f"Triggered {len(alerts)} alerts for new earthquake {earthquake['bmkg_event_id']}")
    
    # Broadcast alerts to all listening simulator clients via SSE
    for alert in alerts:
        broadcast_push_notification(alert)

def broadcast_push_notification(alert: dict):
    """Sends a push notification event payload to all active SSE streaming clients."""
    payload = {
        "event": "push_notification",
        "data": alert
    }
    if main_loop:
        for q in sse_queues:
            main_loop.call_soon_threadsafe(q.put_nowait, payload)
    else:
        # Fallback to current running loop if any
        try:
            loop = asyncio.get_running_loop()
            for q in sse_queues:
                loop.create_task(q.put(payload))
        except RuntimeError:
            logger.warning("No running event loop to broadcast notification.")

async def polling_worker_loop():
    """Background loop to periodically trigger BMKG polling."""
    global main_loop
    main_loop = asyncio.get_running_loop()
    logger.info("Starting BMKG polling worker background loop...")
    while True:
        try:
            # We run the fetch in a separate thread so it doesn't block the asyncio loop
            await asyncio.to_thread(fetch_latest_earthquakes)
        except Exception as e:
            logger.error(f"Error in polling worker loop iteration: {e}")
        await asyncio.sleep(POLL_INTERVAL_SECONDS)
