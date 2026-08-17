import os
import pytest
from backend.app.alert_engine import (
    haversine_distance, normalize_text, check_felt_area_match, 
    get_alert_distance_threshold, evaluate_alert, run_alert_engine
)
from backend.app.storage import Storage

# Set a mock file for testing
os.environ["STORAGE_FILE_PATH"] = "test_devices.json"

@pytest.fixture(autouse=True)
def clean_storage():
    # Clean up test storage file before and after tests
    if os.path.exists("test_devices.json"):
        os.remove("test_devices.json")
    from backend.app import storage
    storage._db = {"devices": {}, "notification_logs": []}
    yield
    if os.path.exists("test_devices.json"):
        os.remove("test_devices.json")

def test_haversine_distance():
    # Jakarta to Bandung distance (~120 km)
    # Jakarta: -6.2088, 106.8456
    # Bandung: -6.9175, 107.6191
    dist = haversine_distance(-6.2088, 106.8456, -6.9175, 107.6191)
    assert 115.0 < dist < 125.0

def test_normalize_text():
    assert normalize_text("Kabupaten Sukabumi") == "sukabumi"
    assert normalize_text("Kota Jakarta Selatan") == "jakarta selatan"
    assert normalize_text("Provinsi Banten") == "banten"
    assert normalize_text("Jayapura") == "jayapura"

def test_check_felt_area_match():
    # Case insensitive matching
    assert check_felt_area_match("Kabupaten Sukabumi", "III Sukabumi, II Cianjur") is True
    assert check_felt_area_match("Jakarta Selatan", "IV Jakarta, III Depok") is True
    assert check_felt_area_match("Surabaya", "II Wamena") is False

def test_get_alert_distance_threshold():
    assert get_alert_distance_threshold(6.5) == 500.0
    assert get_alert_distance_threshold(5.2) == 250.0
    assert get_alert_distance_threshold(4.1) == 100.0
    assert get_alert_distance_threshold(3.2) == 50.0
    assert get_alert_distance_threshold(2.5) == 0.0

def test_evaluate_alert():
    # Scenario: M 5.2 earthquake in Selat Sunda (-6.2, 105.8), felt in Jakarta
    # Location 1: Jakarta (-6.2, 106.8), distance is ~110km
    # Magnitude is 5.2 (threshold is 250km) -> Should alert!
    eq = {
        "bmkg_event_id": "test_eq_1",
        "magnitude": 5.2,
        "depth_km": 20,
        "latitude": -6.2,
        "longitude": 105.8,
        "tsunami_potential": "Tidak berpotensi",
        "dirasakan": "III Jakarta, II Banten",
        "region": "Selat Sunda"
    }
    
    loc_jakarta = {
        "id": 1,
        "name": "Jakarta",
        "type": "city",
        "latitude": -6.2088,
        "longitude": 106.8456,
        "enabled": True
    }
    
    should_alert, severity = evaluate_alert(eq, loc_jakarta)
    assert should_alert is True
    assert severity == "WARNING"

    # Location 2: Papua (-4.2, 138.0), distance is ~3500km, not in felt areas -> Should NOT alert
    loc_papua = {
        "id": 2,
        "name": "Wamena",
        "type": "city",
        "latitude": -4.0950,
        "longitude": 138.9482,
        "enabled": True
    }
    
    should_alert, severity = evaluate_alert(eq, loc_papua)
    assert should_alert is False

def test_run_alert_engine_deduplication():
    # Register a mock device with 1 location
    Storage.save_device({
        "installation_id": "device_123",
        "platform": "web_sim",
        "push_token": "token_123",
        "locations": [
            {
                "id": 1,
                "name": "Jakarta",
                "type": "city",
                "latitude": -6.2088,
                "longitude": 106.8456,
                "enabled": True
            }
        ]
    })
    
    eq = {
        "bmkg_event_id": "eq_999",
        "magnitude": 5.2,
        "depth_km": 20,
        "latitude": -6.2,
        "longitude": 105.8,
        "tsunami_potential": "Tidak berpotensi",
        "dirasakan": "III Jakarta",
        "region": "Selat Sunda"
    }

    # First run: should yield 1 alert
    alerts = run_alert_engine(eq)
    assert len(alerts) == 1
    assert alerts[0]["location_name"] == "Jakarta"
    assert alerts[0]["severity"] == "WARNING"

    # Second run (same eq and device): should yield 0 alerts (deduplicated)
    alerts2 = run_alert_engine(eq)
    assert len(alerts2) == 0
