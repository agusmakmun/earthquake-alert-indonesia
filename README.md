# Earthquake Alert Indonesia

Earthquake Alert Indonesia is a real-time Earthquake Early Warning (EEW) application. It polls official open data feeds from the **Badan Meteorologi, Klimatologi, dan Geofisika (BMKG)**, normalizes event data, evaluates custom proximity/felt rules, and pushes instant alerts to mobile devices.

---

## 1. Project Architecture

The system uses a database-less architecture designed to run lightweight and fast:
* **Background Worker**: Periodically checks BMKG open JSON APIs (`autogempa`, `gempadirasakan`, `gempaterkini`) every 30 seconds.
* **Alert Engine**: Evaluates incoming events against user registered coordinates using a hybrid priority rule:
  1. **Felt-Area Text Matching**: Regex parses the felt description (e.g. `"III Jakarta"`) and matches user locations (e.g. `"Jakarta Pusat"`).
  2. **Haversine Proximity Check**: Fallback distance checks matching coordinates to magnitude-based radius limits.
* **Persistent Registry**: Stores devices, monitoring locations, and notification history locally in a thread-safe `devices.json` file.
* **SSE Stream**: Server-Sent Events channel (`/api/v1/stream`) to broadcast instant alerts to connected simulator clients.

---

## 2. Directory Structure

```text
├── backend/                   # FastAPI backend server
│   ├── app/
│   │   ├── main.py            # API routing & SSE server
│   │   ├── config.py          # Port & URL constant configuration
│   │   ├── worker.py          # BMKG Polling loop
│   │   ├── alert_engine.py    # Proximity & text MMI logic
│   │   ├── storage.py         # devices.json CRUD wrapper
│   │   └── seed_data.py       # Indonesian city centroids
│   └── tests/                 # Pytest engine test suites
│
├── frontend/                  # Cross-platform mobile codebase
│   ├── lib/
│   │   ├── screens/           # Home (with history), Settings, Maps, Details
│   │   ├── services/          # api_service.dart REST communicator
│   │   └── main.dart          # State management & themes
│   └── pubspec.yaml           # Flutter requirements configuration
│
├── simulator/                 # HTML phone mock & developer console
│   ├── index.html             # UI layout structure
│   ├── style.css              # Glassmorphic bezels styling
│   └── simulator.js           # EventSource stream connection
│
└── devices.json               # Local persistent database file
```

---

## 3. Getting Started

### Prerequisites
* Python 3.10+
* Flutter SDK (for mobile compilation)
* Xcode / CocoaPods (for iOS compilation)

### 1. Launch the Backend Server
Setup the virtual environment, install requirements, and run the backend server:
```bash
# Navigate to the workspace root
cd earthquake-early-warning

# Create virtual environment and install packages
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt   # Or pip install fastapi uvicorn requests pydantic pytest

# Run the server
PYTHONPATH=. .venv/bin/uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

### 2. Run the Web Simulator & Developer Console
Open your web browser and go to:
* **Simulator Portal**: [http://127.0.0.1:8000/](http://127.0.0.1:8000/)

Here you can:
* Use the **Simulated Phone** on the left to CRUD settings, add locations, and view map epicenters.
* Use the **Developer Panel** on the right to choose presets (e.g. `sunda_felt`) and trigger mock earthquakes to test alert matching.

### 3. Run Automated Tests
Execute the test suites verifying alert matching and coordinates distance calculations:
```bash
PYTHONPATH=. .venv/bin/pytest backend/tests/
```

---

## 4. Testing on Native Mobile (iOS/Android)

The Flutter codebase is stored in the `frontend/` directory.

### iOS Simulator
1. Connect your simulator or open it: `open -a Simulator`
2. Configure packages and pods:
   ```bash
   cd frontend
   flutter pub get
   cd ios
   pod install
   cd ..
   ```
3. Run the application:
   ```bash
   flutter run
   ```

### Physical iPhone
To compile and deploy to a physical iPhone:
1. Ensure the iPhone and Mac are on the **same Wi-Fi network**.
2. Open Xcode: `open frontend/ios/Runner.xcworkspace`
3. Go to **Signing & Capabilities**, check **Automatically manage signing**, and select your personal Apple ID team.
4. Run `flutter devices` to copy your iPhone's device ID.
5. Deploy:
   ```bash
   flutter run -d <YOUR_DEVICE_ID>
   ```
*(First time runs require trusting your developer certificate under **Settings > General > VPN & Device Management** on your iPhone).*

---

## 5. API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/v1/devices` | `POST` | Register a new device installation |
| `/api/v1/devices/{id}` | `PATCH` | Update push token for a device |
| `/api/v1/locations` | `GET` | Retrieve monitoring locations |
| `/api/v1/locations` | `POST` | Add a monitoring location (limit 5) |
| `/api/v1/locations/{id}` | `DELETE` | Remove a monitoring location |
| `/api/v1/earthquakes/latest`| `GET` | Get cached autogempa, felt, and M5.0+ feeds |
| `/api/v1/stream` | `GET` | Server-Sent Events stream for push warning broadcasts |
| `/api/v1/mock/trigger` | `POST` | Trigger custom mock earthquake to evaluate alerts |
