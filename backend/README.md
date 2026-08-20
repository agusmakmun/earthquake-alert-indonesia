# Cloudflare Workers Backend

This directory contains the serverless Cloudflare Workers backend for Earthquake Alert Indonesia.

## Files

- **`src/index.js`** - Main Worker handler with all API endpoints
- **`src/storage.js`** - KV storage layer abstraction
- **`src/alertEngine.js`** - Alert matching logic (proximity + felt area)
- **`src/bmkg.js`** - BMKG API polling and parsing
- **`src/seedData.js`** - Indonesian provinces and cities
- **`wrangler.toml`** - Worker configuration with fallback Cron and KV bindings
- **`package.json`** - Dependencies

## Deployment

See [../CLOUDFLARE_MIGRATION.md](../CLOUDFLARE_MIGRATION.md) for full deployment instructions.

Quick start:
```bash
npm install
wrangler login
wrangler kv:namespace create DEVICES_KV
# Update wrangler.toml with namespace ID
wrangler dev    # Test locally
wrangler deploy # Deploy
```

## Features

- ✅ Serverless (no server maintenance needed)
- ✅ Global edge deployment (low latency for Indonesian users)
- ✅ Free tier: 100k requests/day
- ✅ Authenticated push ingestion at `/webhook/earthquake`
- ✅ Cron polling every 1 minute as a fallback
- ✅ KV storage for devices & locations
- ✅ SSE streaming for real-time alerts
- ✅ Full API compatibility with the previous backend

## Low-latency ingestion

Cloudflare Workers cannot keep a permanent outbound WebSocket connection to EMSC or BMKG. Run a small always-on stream bridge that subscribes to the EMSC WebSocket (or BMKG stream) and POSTs each event to the Worker:

```bash
wrangler secret put WEBHOOK_SECRET
curl -X POST https://YOUR_WORKER.workers.dev/webhook/earthquake \
	-H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \
	-H "Content-Type: application/json" \
	-d '{"id":"bridge-event-1","magnitude":5.4,"latitude":-6.2,"longitude":106.8,"region":"Java"}'
```

The webhook is idempotent by event ID, stores the event, evaluates registered locations, and emits the existing SSE alert immediately. Keep the Cron trigger enabled as a recovery path when the bridge or upstream stream is unavailable. For native mobile delivery, the bridge/Worker must also connect the generated alert payloads to FCM or Web Push; SSE is intended for the simulator and connected clients.
