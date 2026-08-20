# Earthquake Alert Indonesia

Earthquake Alert Indonesia is a real-time Earthquake Early Warning (EEW) application. It polls official open data feeds from the **Badan Meteorologi, Klimatologi, dan Geofisika (BMKG)**, normalizes event data, evaluates custom proximity/felt rules, and pushes instant alerts to mobile devices.

---

## 1. Project Architecture

The system uses a serverless, database-less architecture designed to run globally with zero maintenance:
* **Cloudflare Workers**: Runs on Cloudflare's global edge network (Jakarta location for Indonesian users).
* **Push Webhook**: Accepts events from an always-on EMSC/BMKG stream bridge at `/webhook/earthquake` for low-latency detection.
* **Cron Fallback**: Checks BMKG open JSON APIs (`autogempa`, `gempadirasakan`, `gempaterkini`) every 1 minute when push ingestion is unavailable.
* **Alert Engine**: Evaluates incoming events against user registered coordinates using a hybrid priority rule:
  1. **Felt-Area Text Matching**: Regex parses the felt description (e.g. `"III Jakarta"`) and matches user locations (e.g. `"Jakarta Pusat"`).
  2. **Haversine Proximity Check**: Fallback distance checks matching coordinates to magnitude-based radius limits.
* **Cloudflare KV Storage**: Distributed key-value store for devices, monitoring locations, and notification history.
* **SSE Stream**: Server-Sent Events channel (`/api/v1/stream`) to broadcast instant alerts to connected simulator clients.
* **Free Tier**: 100,000 requests/day, KV 100,000 reads/day — more than enough for personal/community use.

---

## 2. Directory Structure

```text
├── backend/                   # Cloudflare Workers backend
│   ├── src/index.js           # Main handler (REST endpoints, SSE, Cron)
│   ├── src/storage.js         # KV storage abstraction
│   ├── src/alertEngine.js     # Proximity & felt area matching logic
│   ├── src/bmkg.js             # BMKG API polling & parsing
│   └── src/seedData.js         # Indonesian province/city centroids
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
├── backend/wrangler.toml      # Cloudflare Workers configuration
├── backend/package.json       # Node.js dependencies
└── CLOUDFLARE_MIGRATION.md    # Deployment & setup guide
```

---

## 3. Getting Started

### Prerequisites
* Node.js 18+ and pnpm 9+ (for Cloudflare Workers development)
* Cloudflare account (free tier works fine)
* Flutter SDK (for mobile development)
* Xcode / CocoaPods (for iOS compilation)

### 1. Deploy the Backend (Cloudflare Workers)

**For detailed deployment instructions**, see [CLOUDFLARE_MIGRATION.md](CLOUDFLARE_MIGRATION.md).

Quick start:
```bash
# Work from the Worker directory
cd backend

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

### Push Webhook

Set the secret with `wrangler secret put WEBHOOK_SECRET`, then configure the stream bridge to POST events with `Authorization: Bearer <secret>`. The Worker deduplicates by event ID and immediately runs the alert engine.

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
From the repository root:

```bash
pnpm install
```

Create `backend/.dev.vars` for the local webhook secret:

```env
WEBHOOK_SECRET=local-secret
```

Start the Worker:

```bash
pnpm dev
```

This starts both services:

- Worker API: `http://127.0.0.1:8787`
- Browser simulator: `http://127.0.0.1:3000`

Open the simulator in a browser, or use the second terminal for API requests. The Flutter app remains a separate process because it uses the Flutter toolchain, not pnpm.

To start the Worker and Flutter app together instead:

```bash
pnpm dev:mobile
```

Flutter must be installed and a simulator, emulator, or physical device must be available. Use `pnpm dev` for the browser simulator.

Register a test device, then send an earthquake through the fast webhook path:

```bash
curl -X POST http://127.0.0.1:8787/api/v1/devices \
  -H "Content-Type: application/json" \
  -d '{"installation_id":"test-device","platform":"web","push_token":"test-token"}'

curl -X POST http://127.0.0.1:8787/webhook/earthquake \
  -H "Authorization: Bearer local-secret" \
  -H "Content-Type: application/json" \
  -d '{"id":"local-test-001","magnitude":5.4,"latitude":-6.2,"longitude":106.8,"depth_km":10,"region":"Jakarta","location_description":"Near Jakarta"}'
```

For a direct alert-engine smoke test, use `/api/v1/mock/trigger` instead. Local KV data is managed by Wrangler and is separate from production KV.

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
