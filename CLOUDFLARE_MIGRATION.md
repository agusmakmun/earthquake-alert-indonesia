# Cloudflare Workers Migration Guide

## ✅ Migration Complete

The backend now runs entirely as **Cloudflare Workers** (JavaScript) in `backend/`. The legacy FastAPI backend has been removed.

---

## 📁 New Files Created

### Core Backend Files
- **`backend/src/index.js`** - Main Worker handler, API endpoints, SSE, and webhook
- **`backend/src/storage.js`** - KV storage layer
- **`backend/src/alertEngine.js`** - Alert matching logic
- **`backend/src/bmkg.js`** - BMKG polling and earthquake data parsing
- **`backend/src/seedData.js`** - Indonesian provinces and cities data

### Configuration Files
- **`backend/wrangler.toml`** - Cloudflare Workers configuration
- **`backend/package.json`** - Node.js dependencies and scripts

### Updated Files
- **`frontend/lib/services/api_service.dart`** - Updated to use Cloudflare endpoint instead of localhost

---

## 🚀 Deployment Steps

### 1. Install Wrangler CLI (if not already installed)
```bash
npm install -g wrangler
```

### 2. Authenticate with Cloudflare
```bash
wrangler login
```
This will open a browser window to authenticate with your Cloudflare account.

### 3. Create KV Namespaces
```bash
# Create production namespace
wrangler kv:namespace create "DEVICES_KV"

# Create preview namespace (for testing)
wrangler kv:namespace create "DEVICES_KV" --preview
```

The output will show IDs like:
```
✨ Created KV namespace: DEVICES_KV
 id = "abc123def456ghi789"
 preview_id = "xyz789uvw456rst123"
```

### 4. Update `wrangler.toml` with Your KV Namespace IDs
Replace the placeholder IDs in `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "DEVICES_KV"
id = "YOUR_KV_NAMESPACE_ID"        # Replace with actual ID
preview_id = "YOUR_KV_PREVIEW_ID"  # Replace with actual preview ID
```

### 5. Install Dependencies
```bash
npm install
```

### 6. Test Locally
```bash
wrangler dev
```
This starts a local server at `http://127.0.0.1:8787`. You can now test the API locally.

### 7. Deploy to Cloudflare
```bash
wrangler deploy
```

After deployment, your endpoint will be available at:
```
https://YOUR_WORKER_NAME.YOUR_ACCOUNT.workers.dev
```

---

## 📱 Update Flutter Frontend

Once deployed, update `frontend/lib/services/api_service.dart`:

```dart
class ApiService {
  static String baseUrl = 'https://YOUR_WORKER_NAME.YOUR_ACCOUNT.workers.dev';
}
```

Replace `YOUR_WORKER_NAME` and `YOUR_ACCOUNT` with your Cloudflare details (shown after deployment).

---

## 🏗️ Architecture Overview

### Old (FastAPI)
```
Python uvicorn server → devices.json (file storage) → SSE streaming
```

### New (Cloudflare Workers)
```
EMSC/BMKG stream bridge → /webhook/earthquake → KV → alert engine → FCM/Web Push
                                  └── 1-minute Cron fallback → BMKG JSON feeds
```

### Key Changes

| Component | Old (FastAPI) | New (Cloudflare) |
|-----------|---|---|
| **Storage** | `devices.json` (local file) | Cloudflare KV (globally distributed) |
| **Detection** | Continuous `while True` loop (30 seconds) | Push webhook; 1-minute Cron fallback |
| **Execution** | Always running server | Serverless (triggered on demand) |
| **Latency** | Depends on server location | <20ms (edge locations) |
| **Cost** | VPS/server fees | Free tier: 100,000 req/day |
| **Scaling** | Manual | Automatic |

---

## 🎯 API Endpoints (Unchanged)

All endpoints remain the same as the FastAPI backend:

### Devices
- `POST /api/v1/devices` - Register a new device
- `PATCH /api/v1/devices/{installation_id}` - Update device

### Locations
- `GET /api/v1/locations` - Get monitoring locations (requires `X-Installation-Id` header)
- `POST /api/v1/locations` - Add a new location
- `PATCH /api/v1/locations/{location_id}` - Update location
- `DELETE /api/v1/locations/{location_id}` - Delete location

### Earthquakes
- `GET /api/v1/earthquakes/latest` - Get latest earthquakes (latest, felt, M5.0+)
- `GET /api/v1/earthquakes/{id}` - Get specific earthquake details

### Regions
- `GET /api/v1/regions` - Get provinces and cities dropdown data

### Admin
- `GET /api/v1/admin/stats` - Get system statistics

### Testing
- `POST /api/v1/mock/trigger` - Inject mock earthquake (for testing)
- `GET /api/v1/stream` - SSE stream for push notifications
- `POST /webhook/earthquake` - Authenticated push ingestion for stream bridges

---

## 🔧 Monitoring & Debugging

### View Worker Logs
```bash
wrangler tail
```

### Monitor Real-Time Requests
```bash
wrangler tail --format pretty
```

### Check KV Storage Usage
```bash
wrangler kv:key list --namespace-id YOUR_KV_NAMESPACE_ID
```

---

## 💡 Important Notes

1. **SSE Implementation**: The current SSE implementation uses in-memory controllers. For production with multiple Worker instances, consider using Durable Objects or a message queue.

2. **Push ingestion**: Configure an always-on bridge for `wss://www.seismicportal.eu/standing_order/websocket` or a BMKG stream, then POST normalized events to `/webhook/earthquake` with `Authorization: Bearer <WEBHOOK_SECRET>`. Set the secret with `wrangler secret put WEBHOOK_SECRET`.
3. **BMKG fallback polling**: Runs every 1 minute via Cron trigger in `backend/wrangler.toml` when the bridge is unavailable.
4. **Mobile delivery**: SSE remains useful for simulators and connected clients. Production mobile alerts still need an FCM/Web Push sender using the alert payload and registered device token.

3. **Free Tier Limits**:
   - 100,000 requests/day
   - KV: 100,000 reads/day, 1,000 writes/day
   - D1: 5 million reads/day, 100,000 writes/day

4. **Regional Performance**: Your worker runs at Cloudflare's Jakarta edge location, providing ultra-low latency for Indonesian users.

---

## ⚠️ Migration Checklist

- [ ] Install Wrangler CLI
- [ ] Authenticate with Cloudflare (`wrangler login`)
- [ ] Create KV namespaces
- [ ] Update `wrangler.toml` with namespace IDs
- [ ] Run `npm install`
- [ ] Test locally (`wrangler dev`)
- [ ] Deploy (`wrangler deploy`)
- [ ] Update Flutter app with new endpoint
- [ ] Test push notifications with mock earthquake endpoint
- [ ] Monitor logs in production (`wrangler tail`)

---

## 🎉 You're All Set!

Your Earthquake Alert Indonesia backend is now running on Cloudflare Workers!

Questions or issues? Check the [Wrangler documentation](https://developers.cloudflare.com/workers/wrangler/).
