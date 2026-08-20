// src/bmkg.js
// BMKG API polling and earthquake data parsing

const BMKG_AUTO_GEMPA_URL = "https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json";
const BMKG_GEMPA_DIRASAKAN_URL = "https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json";
const BMKG_GEMPA_TERKINI_URL = "https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json";

/**
 * Parse comma-separated coordinates, e.g., '-4.27,139.28' -> [-4.27, 139.28]
 */
function parseCoordinates(coordinatesStr) {
  try {
    const parts = coordinatesStr.split(",");
    return [parseFloat(parts[0]), parseFloat(parts[1])];
  } catch {
    return [0.0, 0.0];
  }
}

/**
 * Parse depth string like '91 km' or '10 Km' -> 91.0
 */
function parseDepth(depthStr) {
  try {
    const match = depthStr.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0.0;
  } catch {
    return 0.0;
  }
}

/**
 * Normalize raw BMKG JSON earthquake record
 */
export function normalizeEarthquakeData(rawGempa) {
  const dateTimeStr = rawGempa.DateTime || "";
  const coordinatesStr = rawGempa.Coordinates || "";
  const [lat, lng] = parseCoordinates(coordinatesStr);
  
  // Event ID is DateTime (unique to each event)
  const eventId =
    dateTimeStr ||
    `eq_${rawGempa.Tanggal}_${rawGempa.Jam}`;
  
  const shakemap = rawGempa.Shakemap;
  const shakemapUrl =
    shakemap && shakemap !== "-"
      ? `https://static.bmkg.go.id/${shakemap}`
      : null;
  
  // Extract region from Wilayah
  let wilayah = rawGempa.Wilayah || "";
  let region = wilayah;
  
  if (wilayah.includes(" dari ")) {
    region = wilayah.split(" dari ").pop();
  } else if (wilayah.includes(" km ")) {
    const parts = wilayah.split(" ");
    const kmIndex = parts.indexOf("km");
    if (kmIndex >= 0) {
      region = parts.slice(kmIndex + 3).join(" ");
    }
  }
  
  return {
    bmkg_event_id: eventId,
    event_time: dateTimeStr || new Date().toISOString(),
    latitude: lat,
    longitude: lng,
    magnitude: parseFloat(rawGempa.Magnitude || 0),
    depth_km: parseDepth(rawGempa.Kedalaman || "0"),
    location_description: wilayah,
    region: region.trim(),
    tsunami_potential: rawGempa.Potensi || "Tidak berpotensi",
    dirasakan: rawGempa.Dirasakan || null,
    shakemap_url: shakemapUrl,
    raw_data: rawGempa,
    created_at: new Date().toISOString(),
  };
}

/**
 * Fetch and parse BMKG API endpoint
 */
async function fetchBMKGFeed(url) {
  try {
    const response = await fetch(url, { timeout: 10000 });
    if (!response.ok) {
      console.warn(`Failed to fetch ${url}: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    const gempaData = data.Infogempa?.gempa;
    
    if (!gempaData) return [];
    if (!Array.isArray(gempaData)) return [gempaData];
    return gempaData;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error.message);
    return [];
  }
}

/**
 * Fetch latest earthquakes from all BMKG feeds
 * Returns { newEarthquakes, updatedCache }
 */
export async function fetchLatestEarthquakes(currentCache) {
  const newEarthquakes = [];
  const updatedCache = { ...currentCache };
  
  // Fetch autogempa (latest)
  try {
    const autoGempaList = await fetchBMKGFeed(BMKG_AUTO_GEMPA_URL);
    if (autoGempaList.length > 0) {
      const normalized = normalizeEarthquakeData(autoGempaList[0]);
      const eqId = normalized.bmkg_event_id;
      
      const isNew = !currentCache.all[eqId];
      updatedCache.all[eqId] = normalized;
      updatedCache.latest = normalized;
      
      if (isNew) {
        console.log(`New auto-gempa: M${normalized.magnitude} in ${normalized.region}`);
        newEarthquakes.push(normalized);
      }
    }
  } catch (error) {
    console.error("Error processing autogempa:", error);
  }
  
  // Fetch gempadirasakan (felt)
  try {
    const feltList = await fetchBMKGFeed(BMKG_GEMPA_DIRASAKAN_URL);
    const normalizedFelt = [];
    
    for (const item of feltList) {
      const normalized = normalizeEarthquakeData(item);
      const eqId = normalized.bmkg_event_id;
      
      const isNew = !currentCache.all[eqId];
      updatedCache.all[eqId] = normalized;
      normalizedFelt.push(normalized);
      
      if (isNew) {
        console.log(`New felt-gempa: M${normalized.magnitude} felt in ${normalized.dirasakan}`);
        newEarthquakes.push(normalized);
      }
    }
    
    updatedCache.felt = normalizedFelt;
  } catch (error) {
    console.error("Error processing gempadirasakan:", error);
  }
  
  // Fetch gempaterkini (M5.0+)
  try {
    const m5List = await fetchBMKGFeed(BMKG_GEMPA_TERKINI_URL);
    const normalizedM5 = [];
    
    for (const item of m5List) {
      const normalized = normalizeEarthquakeData(item);
      const eqId = normalized.bmkg_event_id;
      
      const isNew = !currentCache.all[eqId];
      updatedCache.all[eqId] = normalized;
      normalizedM5.push(normalized);
      
      if (isNew) {
        console.log(`New M5.0+ gempa: M${normalized.magnitude} in ${normalized.region}`);
        newEarthquakes.push(normalized);
      }
    }
    
    updatedCache.m5 = normalizedM5;
  } catch (error) {
    console.error("Error processing gempaterkini:", error);
  }
  
  return { newEarthquakes, updatedCache };
}
