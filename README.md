# Earthquake Alert Indonesia

Earthquake Alert Indonesia is a real-time Earthquake Early Warning (EEW) application. It polls official open data feeds from the **Badan Meteorologi, Klimatologi, dan Geofisika (BMKG)**, normalizes event data, evaluates custom proximity/felt rules, and pushes instant alerts to mobile devices.

---

## 1. Project Architecture

The system uses a serverless, database-less architecture designed to run globally with zero maintenance:
* **Cloudflare Workers**: Runs on Cloudflare's global edge network (Jakarta location for Indonesian users).
* **Cron Triggers**: Periodically checks BMKG open JSON APIs (`autogempa`, `gempadirasakan`, `gempaterkini`) every 1 minute.
* **Alert Engine**: Evaluates incoming events against user registered coordinates using a hybrid priority rule:
  1. **Felt-Area Text Matching**: Regex parses the felt description (e.g. `"III Jakarta"`) and matches user locations (e.g. `"Jakarta Pusat"`).
  2. **Haversine Proximity Check**: Fallback distance checks matching coordinates to magnitude-based radius limits.
* **Cloudflare KV Storage**: Distributed key-value store for devices, monitoring locations, and notification history.
* **SSE Stream**: Server-Sent Events channel (`/api/v1/stream`) to broadcast instant alerts to connected simulator clients.
* **Free Tier**: 100,000 requests/day, KV 100,000 reads/day — more than enough for personal/community use.

---

## 2. Directory Structure

```text
├── src/                       # Cloudflare Workers backend
│   ├── index.js               # Main handler (REST endpoints, SSE, Cron)
│   ├── storage.js             # KV storage abstraction
│   ├── alertEngine.js         # Proximity & felt area matching logic
│   ├── bmkg.js                # BMKG API polling & parsing
│   └── seedData.js            # Indonesian province/city centroids
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
├── backend/                   # (Legacy) FastAPI reference (kept for reference only)
│   └── ...                    # Superseded by Cloudflare Workers (src/)
│
├── wrangler.toml              # Cloudflare Workers configuration
├── package.json               # Node.js dependencies
└── CLOUDFLARE_MIGRATION.md    # Deployment & setup guide
```

---

## 3. Getting Started

### Prerequisites
* Node.js 18+ (for Cloudflare Workers development)
* Wrangler CLI (`npm install -g wrangler`)
* Cloudflare account (free tier works fine)
* Flutter SDK (for mobile development)
* Xcode / CocoaPods (for iOS compilation)

### 1. Deploy the Backend (Cloudflare Workers)

**For detailed deployment instructions**, see [CLOUDFLARE_MIGRATION.md](CLOUDFLARE_MIGRATION.md).

Quick start:
```bash
# Install dependencies
npm install

# Authenticate with Cloudflare
wrangler login

# Create a KV namespace for device storage
wrangler kv:namespace create DEVICES_KV

# Update wrangler.toml with the KV namespace ID
# Then test locally:
wrangler dev

# Deploy to production:
wrangler deploy
```

Your backend will be live at: `https://YOUR_WORKER_NAME.YOUR_ACCOUNT.workers.dev`

### 2. Configure the Flutter Frontend

Update `frontend/lib/services/api_service.dart`:
```dart
class ApiService {
  static String baseUrl = 'https://YOUR_WORKER_NAME.YOUR_ACCOUNT.workers.dev';
}
```

### 3. Build & Run on Mobile

**iOS Simulator:**
```bash
cd frontend
flutter pub get
cd ios && pod install && cd ..
flutter run
```

**Physical iPhone:**
1. Ensure iPhone and Mac are on the same Wi-Fi network.
2. `flutter devices` → copy your iPhone's device ID
3. `flutter run -d <YOUR_DEVICE_ID>`

---

## 4. Testing

### Mock Earthquake Endpoint (for testing)
Trigger a mock earthquake to verify alert matching logic:
```bash
curl -X POST https://YOUR_WORKER_NAME.YOUR_ACCOUNT.workers.dev/api/v1/mock/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "magnitude": 5.5,
    "depth_km": 50,
    "latitude": -6.2088,
    "longitude": 106.8456,
    "location_description": "Selat Sunda",
    "region": "Jakarta",
    "dirasakan": "III Jakarta, II Depok"
  }'
```

### Local Development
During development, run `wrangler dev` to test locally at `http://127.0.0.1:8787`.

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
