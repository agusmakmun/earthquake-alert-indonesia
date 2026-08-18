# Cloudflare Workers Backend

This directory contains the serverless Cloudflare Workers implementation of the Earthquake Alert Indonesia backend.

## Files

- **`src/index.js`** - Main Worker handler with all API endpoints
- **`src/storage.js`** - KV storage layer abstraction
- **`src/alertEngine.js`** - Alert matching logic (proximity + felt area)
- **`src/bmkg.js`** - BMKG API polling and parsing
- **`src/seedData.js`** - Indonesian provinces and cities
- **`wrangler.toml`** - Worker configuration with Cron triggers and KV bindings
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
- ✅ Automatic Cron polling every 1 minute
- ✅ KV storage for devices & locations
- ✅ SSE streaming for real-time alerts
- ✅ Full API compatibility with FastAPI backend
