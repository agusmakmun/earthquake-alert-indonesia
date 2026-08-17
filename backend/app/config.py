import os

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://eq_user:eq_password@localhost:5434/earthquake_db"
)

POLL_INTERVAL_SECONDS = int(os.getenv("POLL_INTERVAL_SECONDS", "30"))

LOCATION_LIMIT_PER_DEVICE = int(os.getenv("LOCATION_LIMIT_PER_DEVICE", "5"))

BMKG_AUTO_GEMPA_URL = os.getenv(
    "BMKG_AUTO_GEMPA_URL",
    "https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json"
)

BMKG_GEMPA_DIRASAKAN_URL = os.getenv(
    "BMKG_GEMPA_DIRASAKAN_URL",
    "https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json"
)

BMKG_GEMPA_TERKINI_URL = os.getenv(
    "BMKG_GEMPA_TERKINI_URL",
    "https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json"
)
