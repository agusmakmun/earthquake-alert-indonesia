// src/index.js
// Main Cloudflare Worker handler with all API endpoints

import { Hono } from "hono";
import { cors } from "hono/cors";
import { PROVINCES, CITIES } from "./seedData.js";
import * as storage from "./storage.js";
import * as alertEngine from "./alertEngine.js";
import * as bmkg from "./bmkg.js";

const app = new Hono();

// CORS middleware
app.use("*", cors({ origin: "*" }));

// In-memory cache for connected SSE clients (stored in Durable Objects or broadcast via queue)
const sseClients = new Set();
const sseEncoder = new TextEncoder();
globalThis.__sseControllers = globalThis.__sseControllers || {};

function broadcastAlerts(alerts) {
  for (const clientId of sseClients) {
    if (typeof globalThis !== "undefined" && globalThis.__sseControllers?.[clientId]) {
      const controller = globalThis.__sseControllers[clientId];
      for (const alert of alerts) {
        controller.enqueue(sseEncoder.encode(`event: push_notification\ndata: ${JSON.stringify(alert)}\n\n`));
      }
    }
  }
}

async function processIncomingEarthquake(earthquake, kv) {
  const cache = await storage.getEarthquakeCache(kv);
  const eventId = earthquake.bmkg_event_id;

  if (cache.all[eventId]) {
    return { duplicate: true, alerts: [] };
  }

  cache.all[eventId] = earthquake;
  cache.latest = earthquake;
  if (earthquake.dirasakan) {
    cache.felt = [earthquake, ...cache.felt].slice(0, 15);
  }
  if (earthquake.magnitude >= 5) {
    cache.m5 = [earthquake, ...cache.m5].slice(0, 15);
  }
  await storage.saveEarthquakeCache(kv, cache);

  const devices = await storage.getAllDevices(kv);
  const alerts = await alertEngine.runAlertEngine(earthquake, devices, kv);
  broadcastAlerts(alerts);
  return { duplicate: false, alerts };
}

// ============================================================================
// 1. DEVICE ENDPOINTS
// ============================================================================

app.post("/api/v1/devices", async (c) => {
  const device = await c.req.json();
  const kv = c.env.DEVICES_KV;
  
  const saved = await storage.saveDevice(kv, device);
  return c.json(saved, 201);
});

app.patch("/api/v1/devices/:installation_id", async (c) => {
  const installationId = c.req.param("installation_id");
  const update = await c.req.json();
  const kv = c.env.DEVICES_KV;
  
  const existing = await storage.getDevice(kv, installationId);
  if (!existing) {
    return c.json({ error: "Device not found" }, 404);
  }
  
  const saved = await storage.saveDevice(kv, { ...existing, ...update });
  return c.json(saved);
});

// ============================================================================
// 2. LOCATION ENDPOINTS
// ============================================================================

app.get("/api/v1/locations", async (c) => {
  const installationId = c.req.header("X-Installation-Id");
  if (!installationId) {
    return c.json({ error: "X-Installation-Id header required" }, 400);
  }
  
  const kv = c.env.DEVICES_KV;
  const device = await storage.getDevice(kv, installationId);
  
  if (!device) {
    return c.json({ error: "Device not registered" }, 404);
  }
  
  return c.json(device.locations || []);
});

app.post("/api/v1/locations", async (c) => {
  const installationId = c.req.header("X-Installation-Id");
  if (!installationId) {
    return c.json({ error: "X-Installation-Id header required" }, 400);
  }
  
  const location = await c.req.json();
  const kv = c.env.DEVICES_KV;
  
  try {
    const newLoc = await storage.addLocation(kv, installationId, location);
    if (!newLoc) {
      return c.json({ error: "Device not registered" }, 404);
    }
    return c.json(newLoc, 201);
  } catch (error) {
    return c.json({ error: error.message }, 400);
  }
});

app.patch("/api/v1/locations/:location_id", async (c) => {
  const installationId = c.req.header("X-Installation-Id");
  const locationId = parseInt(c.req.param("location_id"));
  
  if (!installationId) {
    return c.json({ error: "X-Installation-Id header required" }, 400);
  }
  
  const updates = await c.req.json();
  const kv = c.env.DEVICES_KV;
  
  const updated = await storage.updateLocation(kv, installationId, locationId, updates);
  if (!updated) {
    return c.json({ error: "Location or Device not found" }, 404);
  }
  
  return c.json(updated);
});

app.delete("/api/v1/locations/:location_id", async (c) => {
  const installationId = c.req.header("X-Installation-Id");
  const locationId = parseInt(c.req.param("location_id"));
  
  if (!installationId) {
    return c.json({ error: "X-Installation-Id header required" }, 400);
  }
  
  const kv = c.env.DEVICES_KV;
  const success = await storage.deleteLocation(kv, installationId, locationId);
  
  if (!success) {
    return c.json({ error: "Location or Device not found" }, 404);
  }
  
  return c.text("", 204);
});

// ============================================================================
// 3. EARTHQUAKE ENDPOINTS
// ============================================================================

app.get("/api/v1/earthquakes/latest", async (c) => {
  const kv = c.env.DEVICES_KV;
  const cache = await storage.getEarthquakeCache(kv);
  
  return c.json({
    latest: cache.latest,
    felt: cache.felt,
    m5: cache.m5,
  });
});

app.get("/api/v1/earthquakes/:id", async (c) => {
  const id = c.req.param("id");
  const kv = c.env.DEVICES_KV;
  const cache = await storage.getEarthquakeCache(kv);
  
  const eq = cache.all[id];
  if (!eq) {
    return c.json({ error: "Earthquake event not found" }, 404);
  }
  
  return c.json(eq);
});

// ============================================================================
// 4. REGIONAL DROPDOWNS (Provinces & Cities)
// ============================================================================

app.get("/api/v1/regions", (c) => {
  return c.json({
    provinces: PROVINCES,
    cities: CITIES,
  });
});

// ============================================================================
// 4.5. ADMIN DASHBOARD STATISTICS
// ============================================================================

app.get("/api/v1/admin/stats", async (c) => {
  const kv = c.env.DEVICES_KV;
  const devices = await storage.getAllDevices(kv);
  const totalLocations = devices.reduce((sum, d) => sum + (d.locations?.length || 0), 0);
  
  return c.json({
    sse_clients: sseClients.size,
    devices: devices.length,
    locations: totalLocations,
  });
});

// ============================================================================
// 5. SERVER-SENT EVENTS (SSE) STREAM
// ============================================================================

app.get("/api/v1/stream", async (c) => {
  const kv = c.env.DEVICES_KV;
  let clientId = Math.random().toString(36).substr(2, 9);
  let heartbeat;
  
  // Create a ReadableStream that sends events
  const stream = new ReadableStream({
    start(controller) {
      sseClients.add(clientId);
      console.log(`SSE client connected: ${clientId}. Total: ${sseClients.size}`);
      
      // Send initial connection message
      controller.enqueue(sseEncoder.encode(":connected\n\n"));

      heartbeat = setInterval(() => {
        controller.enqueue(sseEncoder.encode(":keep-alive\n\n"));
      }, 15000);
      
      // Store controller in a way we can access it later
      if (typeof globalThis !== "undefined") {
        globalThis.__sseControllers = globalThis.__sseControllers || {};
        globalThis.__sseControllers[clientId] = controller;
      }
    },
    cancel() {
      clearInterval(heartbeat);
      sseClients.delete(clientId);
      console.log(`SSE client disconnected: ${clientId}. Total: ${sseClients.size}`);
      
      if (typeof globalThis !== "undefined" && globalThis.__sseControllers) {
        delete globalThis.__sseControllers[clientId];
      }
    },
  });
  
  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");
  c.header("Access-Control-Allow-Origin", "*");
  
  return c.newResponse(stream);
});

// ============================================================================
// 5.5. PUSH INGESTION WEBHOOK
// ============================================================================

app.post("/webhook/earthquake", async (c) => {
  const expectedSecret = c.env.WEBHOOK_SECRET;
  const authorization = c.req.header("Authorization");
  if (!expectedSecret || authorization !== `Bearer ${expectedSecret}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const payload = await c.req.json();
  const sourceEvent = payload.earthquake || payload.event || payload;
  const earthquake = sourceEvent.DateTime || sourceEvent.Coordinates
    ? bmkg.normalizeEarthquakeData(sourceEvent)
    : {
        ...sourceEvent,
        bmkg_event_id: sourceEvent.bmkg_event_id || sourceEvent.id,
        event_time: sourceEvent.event_time || new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

  if (!earthquake.bmkg_event_id) {
    return c.json({ error: "Earthquake event ID is required" }, 400);
  }

  const result = await processIncomingEarthquake(earthquake, c.env.DEVICES_KV);
  return c.json({
    status: result.duplicate ? "duplicate" : "accepted",
    event_id: earthquake.bmkg_event_id,
    alerts_triggered: result.alerts.length,
  }, result.duplicate ? 200 : 202);
});

// ============================================================================
// 6. MOCK EARTHQUAKE INJECTION (Developer Tool)
// ============================================================================

app.post("/api/v1/mock/trigger", async (c) => {
  const trigger = await c.req.json();
  const kv = c.env.DEVICES_KV;
  
  const timestamp = new Date().toISOString();
  const eventId = `mock_${Math.floor(Date.now() / 1000)}`;
  
  const mockEq = {
    bmkg_event_id: eventId,
    event_time: timestamp,
    latitude: trigger.latitude,
    longitude: trigger.longitude,
    magnitude: trigger.magnitude,
    depth_km: trigger.depth_km,
    location_description: trigger.location_description,
    region: trigger.region,
    tsunami_potential: trigger.tsunami_potential || "Tidak berpotensi",
    dirasakan: trigger.dirasakan || null,
    shakemap_url: null,
    raw_data: { mock: true },
    created_at: timestamp,
  };
  
  // Get current cache
  const currentCache = await storage.getEarthquakeCache(kv);
  currentCache.all[eventId] = mockEq;
  currentCache.latest = mockEq;
  currentCache.felt.unshift(mockEq);
  if (currentCache.felt.length > 15) {
    currentCache.felt = currentCache.felt.slice(0, 15);
  }
  
  await storage.saveEarthquakeCache(kv, currentCache);
  
  // Run alert engine
  console.log(`Mock earthquake triggered: M${trigger.magnitude} in ${trigger.region}`);
  const devices = await storage.getAllDevices(kv);
  const alerts = await alertEngine.runAlertEngine(mockEq, devices, kv);
  
  broadcastAlerts(alerts);
  
  return c.json(
    {
      status: "success",
      message: `Mock earthquake ${eventId} triggered successfully`,
      event: mockEq,
    },
    201
  );
});

// ============================================================================
// CRON JOB - BMKG POLLING (triggered by Cloudflare Cron)
// ============================================================================

export async function handleCron(event, env, ctx) {
  console.log("BMKG polling cron job triggered");
  
  const kv = env.DEVICES_KV;
  
  // Get current cache
  let currentCache = await storage.getEarthquakeCache(kv);
  
  // Fetch new earthquakes from BMKG
  const { newEarthquakes, updatedCache } = await bmkg.fetchLatestEarthquakes(currentCache);
  
  // Save updated cache
  await storage.saveEarthquakeCache(kv, updatedCache);
  
  // Process new earthquakes
  for (const earthquake of newEarthquakes) {
    const devices = await storage.getAllDevices(kv);
    const alerts = await alertEngine.runAlertEngine(earthquake, devices, kv);
    
    if (alerts.length === 0) continue;
    
    console.log(`Triggered ${alerts.length} alerts for earthquake ${earthquake.bmkg_event_id}`);
    
    broadcastAlerts(alerts);
  }
}

// Export Cron handler
app.fire = async (event, env, ctx) => {
  if (event.type === "cron") {
    return handleCron(event, env, ctx);
  }
};

// ============================================================================
// EXPORT FOR CLOUDFLARE WORKERS
// ============================================================================

export default app;

export const cron = async (event, env, ctx) => {
  return handleCron(event, env, ctx);
};
