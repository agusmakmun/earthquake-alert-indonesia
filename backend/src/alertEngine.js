// src/alertEngine.js
// Alert matching logic: proximity calculations and felt area text matching

/**
 * Calculate haversine distance between two points in kilometers
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371.0; // Earth radius in km
  const toRad = (deg) => deg * (Math.PI / 180);
  
  const dlat = toRad(lat2 - lat1);
  const dlon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dlon / 2) ** 2;
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Normalize regional text for comparison
 */
function normalizeText(text) {
  if (!text) return "";
  let normalized = text.toLowerCase();
  const prefixes = ["kabupaten ", "kab. ", "kota ", "provinsi ", "prov. "];
  
  for (const prefix of prefixes) {
    normalized = normalized.replace(prefix, "");
  }
  
  return normalized.trim();
}

/**
 * Check if location name matches felt areas in earthquake description
 */
function checkFeltAreaMatch(locationName, feltAreasStr) {
  if (!feltAreasStr) return false;
  
  const normLoc = normalizeText(locationName);
  const normFelt = feltAreasStr.toLowerCase();
  
  // Split felt areas by comma
  const feltParts = normFelt.split(",").map(part => part.trim());
  
  for (const part of feltParts) {
    // Strip MMI Roman numeral prefixes (e.g., "iii ", "iii-iv ")
    const cleanedPart = normalizeText(part.replace(/^[ivx]+(?:-[ivx]+)?\s+/i, ""));
    
    if (cleanedPart && (cleanedPart.includes(normLoc) || normLoc.includes(cleanedPart))) {
      return true;
    }
  }
  
  return false;
}

/**
 * Determine alert distance threshold based on magnitude
 */
function getAlertDistanceThreshold(magnitude) {
  if (magnitude >= 6.0) return 500.0;
  if (magnitude >= 5.0) return 250.0;
  if (magnitude >= 4.0) return 100.0;
  if (magnitude >= 3.0) return 50.0;
  return 0.0;
}

/**
 * Evaluate if an earthquake is relevant to a monitoring location
 */
export function evaluateAlert(earthquake, location) {
  const magnitude = parseFloat(earthquake.magnitude || 0);
  const tsunamiPotential = earthquake.tsunami_potential || "";
  const isTsunami = tsunamiPotential.toLowerCase().includes("tsunami");
  
  // Severity mapping
  let severity = "INFO";
  if (magnitude >= 6.0 || isTsunami) {
    severity = "CRITICAL";
  } else if (magnitude >= 4.0) {
    severity = "WARNING";
  }
  
  // Priority 1: Check felt area matching
  const dirasakan = earthquake.dirasakan;
  if (dirasakan && checkFeltAreaMatch(location.name, dirasakan)) {
    console.log(
      `Match found: Location '${location.name}' matched BMKG felt area list: '${dirasakan}'`
    );
    return { shouldAlert: true, severity };
  }
  
  // Priority 2: Check distance-based matching
  const distance = haversineDistance(
    parseFloat(earthquake.latitude),
    parseFloat(earthquake.longitude),
    parseFloat(location.latitude),
    parseFloat(location.longitude)
  );
  
  const threshold = getAlertDistanceThreshold(magnitude);
  
  if (distance <= threshold) {
    console.log(
      `Match found: Location '${location.name}' is ${distance.toFixed(1)} km from epicenter (threshold ${threshold} km)`
    );
    // Alert only on WARNING and CRITICAL to avoid spamming small events
    if (severity !== "INFO") {
      return { shouldAlert: true, severity };
    }
  }
  
  return { shouldAlert: false, severity };
}

/**
 * Run alert engine for a new earthquake
 * Returns list of triggered alerts
 */
export async function runAlertEngine(earthquake, devices, kv) {
  const {
    checkDuplicateNotification,
    logNotification,
  } = await import("./storage.js");
  
  const triggeredAlerts = [];
  const eqId = earthquake.bmkg_event_id;
  
  for (const device of devices) {
    const installationId = device.installation_id;
    const pushToken = device.push_token;
    
    for (const location of device.locations || []) {
      if (location.enabled === false) continue;
      
      const { shouldAlert, severity } = evaluateAlert(earthquake, location);
      if (!shouldAlert) continue;
      
      // Deduplication
      const isDuplicate = await checkDuplicateNotification(kv, eqId, installationId, location.id);
      if (isDuplicate) continue;
      
      // Log notification
      await logNotification(kv, eqId, installationId, location.id, severity);
      
      triggeredAlerts.push({
        installation_id: installationId,
        push_token: pushToken,
        platform: device.platform,
        location_name: location.name,
        location_type: location.type,
        severity,
        earthquake,
      });
    }
  }
  
  return triggeredAlerts;
}
