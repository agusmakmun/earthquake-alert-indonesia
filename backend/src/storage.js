// src/storage.js
// KV storage abstraction layer for devices and locations

const LOCATION_LIMIT_PER_DEVICE = 5;
const NOTIFICATION_LOG_KEY = "notification_logs";

/**
 * Generate a unique key for a device
 */
function getDeviceKey(installationId) {
  return `device:${installationId}`;
}

/**
 * Get all devices (warning: expensive operation, limited to 1000 items)
 */
export async function getAllDevices(kv) {
  const devices = [];
  const list = await kv.list({ prefix: "device:" });
  
  for (const item of list.keys) {
    const deviceData = await kv.get(item.name, "json");
    if (deviceData) devices.push(deviceData);
  }
  
  return devices;
}

/**
 * Get a specific device by installation ID
 */
export async function getDevice(kv, installationId) {
  return await kv.get(getDeviceKey(installationId), "json");
}

/**
 * Create or update a device
 */
export async function saveDevice(kv, deviceData) {
  const installationId = deviceData.installation_id;
  const key = getDeviceKey(installationId);
  
  const existing = await getDevice(kv, installationId);
  const now = new Date().toISOString();
  
  const device = {
    ...deviceData,
    locations: deviceData.locations || (existing?.locations || []),
    created_at: existing?.created_at || now,
    updated_at: now,
    last_seen_at: now,
  };
  
  await kv.put(key, JSON.stringify(device));
  return device;
}

/**
 * Get all locations for a device
 */
export async function getLocations(kv, installationId) {
  const device = await getDevice(kv, installationId);
  return device?.locations || [];
}

/**
 * Add a new monitoring location to a device
 */
export async function addLocation(kv, installationId, locationData) {
  const device = await getDevice(kv, installationId);
  if (!device) return null;
  
  // Check location limit
  if (device.locations.length >= LOCATION_LIMIT_PER_DEVICE) {
    throw new Error(`Limit of ${LOCATION_LIMIT_PER_DEVICE} monitoring locations reached.`);
  }
  
  // Auto-increment location ID
  const nextId = device.locations.length > 0 
    ? Math.max(...device.locations.map(l => l.id)) + 1 
    : 1;
  
  const now = new Date().toISOString();
  const newLocation = {
    id: nextId,
    name: locationData.name,
    type: locationData.type,
    latitude: locationData.latitude,
    longitude: locationData.longitude,
    province_id: locationData.province_id,
    city_id: locationData.city_id,
    enabled: locationData.enabled !== false,
    created_at: now,
    updated_at: now,
  };
  
  device.locations.push(newLocation);
  device.updated_at = now;
  
  await kv.put(getDeviceKey(installationId), JSON.stringify(device));
  return newLocation;
}

/**
 * Update an existing location
 */
export async function updateLocation(kv, installationId, locationId, updates) {
  const device = await getDevice(kv, installationId);
  if (!device) return null;
  
  const location = device.locations.find(l => l.id === locationId);
  if (!location) return null;
  
  Object.assign(location, updates);
  location.updated_at = new Date().toISOString();
  device.updated_at = new Date().toISOString();
  
  await kv.put(getDeviceKey(installationId), JSON.stringify(device));
  return location;
}

/**
 * Delete a location
 */
export async function deleteLocation(kv, installationId, locationId) {
  const device = await getDevice(kv, installationId);
  if (!device) return false;
  
  const initialLength = device.locations.length;
  device.locations = device.locations.filter(l => l.id !== locationId);
  
  if (device.locations.length === initialLength) return false;
  
  device.updated_at = new Date().toISOString();
  await kv.put(getDeviceKey(installationId), JSON.stringify(device));
  return true;
}

/**
 * Check if a notification was already sent for this earthquake/device/location combo
 */
export async function checkDuplicateNotification(kv, earthquakeId, installationId, locationId) {
  const logs = await kv.get(NOTIFICATION_LOG_KEY, "json") || [];
  return logs.some(
    log => log.earthquake_id === earthquakeId && 
            log.installation_id === installationId && 
            log.location_id === locationId
  );
}

/**
 * Log a notification to prevent duplicates
 */
export async function logNotification(kv, earthquakeId, installationId, locationId, severity) {
  const logs = await kv.get(NOTIFICATION_LOG_KEY, "json") || [];
  
  logs.push({
    earthquake_id: earthquakeId,
    installation_id: installationId,
    location_id: locationId,
    severity,
    sent_at: new Date().toISOString(),
  });
  
  // Cap log size to prevent infinite growth (keep last 5000)
  if (logs.length > 5000) {
    logs.splice(0, logs.length - 5000);
  }
  
  await kv.put(NOTIFICATION_LOG_KEY, JSON.stringify(logs));
}

/**
 * Get earthquake cache from KV
 */
export async function getEarthquakeCache(kv) {
  const cache = await kv.get("earthquake_cache", "json");
  return cache || {
    latest: null,
    felt: [],
    m5: [],
    all: {},
  };
}

/**
 * Save earthquake cache to KV
 */
export async function saveEarthquakeCache(kv, cache) {
  await kv.put("earthquake_cache", JSON.stringify(cache), {
    expirationTtl: 86400 * 7, // 7 days
  });
}
