// simulator.js
// Client application logic running inside the simulated mobile device.

const simulatorApiUrl = new URL(window.location.origin);
const simulatorIsLocalHost = ["localhost", "127.0.0.1", "::1"].includes(simulatorApiUrl.hostname);
const API_BASE = simulatorIsLocalHost ? "http://127.0.0.1:8787" : simulatorApiUrl.origin;
const RELEVANT_EARTHQUAKE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
let installationId = localStorage.getItem("installation_id");
let isNotificationsEnabled = true;
let activeView = "home";
let phoneMap = null;
let mapMarkers = [];
let mapCircles = [];
let currentGeoPosition = null;

// Seed data fetched from backend
let provincesList = [];
let citiesList = [];
let userLocations = [];
let latestEarthquake = null;
let feltEarthquakesList = [];
let m5EarthquakesList = [];
let activeHistoryTab = "felt";
let lastSuccessfulUpdate = null;

// SSE connection for push notifications
let sseConnection = null;

// Initialize App
document.addEventListener("DOMContentLoaded", async () => {
    initTime();
    setupTabs();
    
    // Generate Installation ID if not exists
    if (!installationId) {
        installationId = "sim_" + Math.random().toString(36).substring(2, 15);
        localStorage.setItem("installation_id", installationId);
    }
    
    // Register Device on Backend
    await registerDevice();
    
    // Fetch regions & active locations
    await fetchRegions();
    await fetchUserLocations();
    await fetchEarthquakeData();

    // Setup SSE connection for push alerts
    connectSSE();

    // Event listeners
    document.getElementById("toggle-notifications").addEventListener("change", (e) => {
        isNotificationsEnabled = e.target.checked;
        logConsole(`Notifications toggled: ${isNotificationsEnabled ? "ON" : "OFF"}`, "system");
        updateDeviceToken();
    });

    document.getElementById("btn-add-location").addEventListener("click", () => showModal("modal-add-location"));
    document.getElementById("modal-add-close").addEventListener("click", () => hideModal("modal-add-location"));
    document.getElementById("btn-show-disclaimer").addEventListener("click", () => showModal("modal-disclaimer"));
    document.getElementById("modal-disclaimer-close").addEventListener("click", () => hideModal("modal-disclaimer"));
    document.getElementById("btn-close-disclaimer-ok").addEventListener("click", () => hideModal("modal-disclaimer"));
    document.getElementById("btn-back-to-home").addEventListener("click", () => switchView("home"));

    document.getElementById("tab-history-felt").addEventListener("click", () => {
        activeHistoryTab = "felt";
        document.getElementById("tab-history-felt").classList.add("active");
        document.getElementById("tab-history-m5").classList.remove("active");
        renderHistoryList();
    });

    document.getElementById("tab-history-m5").addEventListener("click", () => {
        activeHistoryTab = "m5";
        document.getElementById("tab-history-m5").classList.add("active");
        document.getElementById("tab-history-felt").classList.remove("active");
        renderHistoryList();
    });

    // Modal Tabs setup
    setupModalTabs();

    // GPS location setup
    setupGPSButton();

    // Manual location drop downs change listeners
    setupManualDropdowns();

    // SSE reconnect timer
    setInterval(() => {
        if (!sseConnection || sseConnection.readyState === EventSource.CLOSED) {
            logConsole("SSE disconnected, attempting reconnect...", "warn");
            connectSSE();
        }
    }, 10000);

    // Initial view rendering
    renderHomeView();
});

// Periodic Clock for Simulator Status Bar
function initTime() {
    const updateTime = () => {
        const now = new Date();
        const hrs = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        document.getElementById("phone-time").innerText = `${hrs}:${mins}`;
    };
    updateTime();
    setInterval(updateTime, 1000);
}

// Navigation Tabs Setup
function setupTabs() {
    document.querySelectorAll(".nav-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            const targetView = tab.getAttribute("data-view");
            switchView(targetView);
        });
    });
}

function switchView(viewName) {
    activeView = viewName;
    document.querySelectorAll(".nav-tab").forEach(tab => {
        tab.classList.toggle("active", tab.getAttribute("data-view") === viewName);
    });
    document.querySelectorAll(".app-view").forEach(view => {
        view.classList.toggle("active", view.getAttribute("id") === `view-${viewName}`);
    });

    if (viewName === "map") {
        initLeafletMap();
    } else if (viewName === "home") {
        renderHomeView();
    } else if (viewName === "settings") {
        renderSettingsView();
    }
}

// REST API calls to backend
async function registerDevice() {
    try {
        const resp = await fetch(`${API_BASE}/api/v1/devices`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                installation_id: installationId,
                platform: "web_sim",
                app_version: "1.0.0",
                os_version: navigator.userAgent.substring(0, 30)
            })
        });
        if (resp.ok) {
            const data = await resp.json();
            logConsole(`Device registered on server. ID: ${data.id}`, "info");
            window.updateDashboardStats?.();
        }
    } catch (e) {
        logConsole(`Device registration failed: ${e.message}`, "error");
        setOfflineState();
    }
}

async function updateDeviceToken() {
    try {
        await fetch(`${API_BASE}/api/v1/devices/${installationId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                push_token: isNotificationsEnabled ? "sim_token_" + installationId : null
            })
        });
    } catch (e) {
        logConsole(`Failed to update push token: ${e.message}`, "error");
    }
}

async function fetchRegions() {
    try {
        const resp = await fetch(`${API_BASE}/api/v1/regions`);
        if (resp.ok) {
            const data = await resp.json();
            provincesList = data.provinces;
            citiesList = data.cities;
            populateProvincesDropdown();
        }
    } catch (e) {
        logConsole(`Failed to fetch regions list: ${e.message}`, "error");
    }
}

async function fetchUserLocations() {
    try {
        const resp = await fetch(`${API_BASE}/api/v1/locations`, {
            headers: { "X-Installation-Id": installationId }
        });
        if (resp.ok) {
            userLocations = await resp.json();
            window.updateDashboardStats?.();
        }
    } catch (e) {
        logConsole(`Failed to load locations: ${e.message}`, "error");
    }
}

async function fetchEarthquakeData() {
    try {
        const resp = await fetch(`${API_BASE}/api/v1/earthquakes/latest`);
        if (resp.ok) {
            const data = await resp.json();
            latestEarthquake = data.latest;
            feltEarthquakesList = data.felt || [];
            m5EarthquakesList = data.m5 || [];
            
            lastSuccessfulUpdate = new Date().toLocaleTimeString();
            clearOfflineState();
        }
    } catch (e) {
        logConsole(`Failed to load earthquake data: ${e.message}`, "error");
        setOfflineState();
    }
}

// Render Screens
function renderHomeView() {
    const listContainer = document.getElementById("monitored-locations-list");
    listContainer.innerHTML = "";

    if (userLocations.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-card card">
                <p>Belum ada lokasi pantauan. Pergi ke Pengaturan untuk menambahkan lokasi.</p>
            </div>
        `;
    } else {
        userLocations.forEach(loc => {
            const pill = document.createElement("div");
            pill.className = "location-pill";
            pill.innerHTML = `
                <div class="location-pill-info">
                    <h4>${loc.name}</h4>
                    <span>${loc.type === "current_location" ? "📍 GPS Koordinat" : "🗺️ Wilayah Manual"}</span>
                </div>
                <div class="location-status-dot ${loc.enabled ? '' : 'disabled'}"></div>
            `;
            listContainer.innerHTML += pill.outerHTML;
        });
    }

    // Render the newest earthquake that matches a monitored location.
    const relevantContainer = document.getElementById("relevant-earthquake-card");
    const earthquakeCandidates = [
        latestEarthquake,
        ...feltEarthquakesList,
        ...m5EarthquakesList,
    ].filter(Boolean);
    const uniqueEarthquakes = [...new Map(
        earthquakeCandidates.map(earthquake => [earthquake.bmkg_event_id, earthquake])
    ).values()];
    const relevantEq = uniqueEarthquakes
        .filter(earthquake => {
            const eventTime = new Date(earthquake.event_time).getTime();
            const eventAge = Date.now() - eventTime;
            return eventAge >= 0 && eventAge <= RELEVANT_EARTHQUAKE_RETENTION_MS && isEarthquakeRelevant(earthquake);
        })
        .sort((first, second) => new Date(second.event_time) - new Date(first.event_time))[0] || null;

    if (relevantEq) {
        const isCritical = relevantEq.magnitude >= 6.0 || (relevantEq.tsunami_potential && relevantEq.tsunami_potential.toLowerCase().includes("tsunami"));
        relevantContainer.className = `card eq-alert-card ${isCritical ? 'critical' : ''}`;
        relevantContainer.innerHTML = `
            <div class="eq-badge">M ${relevantEq.magnitude.toFixed(1)}</div>
            <h3>${isCritical ? '🚨 ' : '🌋 '}${relevantEq.region}</h3>
            <p>${relevantEq.location_description}</p>
            <div class="eq-meta">
                <span>Dalaman: <strong>${relevantEq.depth_km} km</strong></span>
                <span>Waktu: <strong>${new Date(relevantEq.event_time).toLocaleTimeString()}</strong></span>
            </div>
            ${relevantEq.dirasakan ? `<div class="eq-meta"><span>Dirasakan: <strong>${relevantEq.dirasakan}</strong></span></div>` : ''}
            <button class="btn-detail" id="btn-show-detail">Lihat Detail</button>
        `;
        document.getElementById("btn-show-detail").addEventListener("click", () => renderDetailView(relevantEq));
    } else {
        relevantContainer.className = "card empty-card";
        relevantContainer.innerHTML = `
            <div class="empty-icon">🌋</div>
            <p>Tidak ada gempa signifikan/relevan terbaru dengan lokasi pantauan Anda.</p>
        `;
    }
    renderHistoryList();
}

function isEarthquakeRelevant(earthquake) {
    if (userLocations.length === 0) return false;

    return userLocations.some(location => {
        if (!location.enabled) return false;

        const isFelt = checkMockFeltMatch(location.name, earthquake.dirasakan);
        const distance = getHaversineDist(
            location.latitude,
            location.longitude,
            earthquake.latitude,
            earthquake.longitude
        );
        const threshold = getDistThresh(earthquake.magnitude);

        return isFelt || (distance <= threshold && earthquake.magnitude >= 4.0);
    });
}

function renderHistoryList() {
    const historyContainer = document.getElementById("history-list");
    if (!historyContainer) return;
    historyContainer.innerHTML = "";

    const list = activeHistoryTab === "felt" ? feltEarthquakesList : m5EarthquakesList;
    if (!list || list.length === 0) {
        historyContainer.innerHTML = `
            <div class="empty-card" style="padding: 1.5rem; text-align: center; font-size: 0.8rem; color: var(--text-secondary);">
                Belum ada data riwayat gempa.
            </div>
        `;
        return;
    }

    list.forEach(eq => {
        const item = document.createElement("div");
        item.className = "history-item";
        
        let severity = "yellow";
        if (eq.magnitude >= 6.0) severity = "red";
        else if (eq.magnitude >= 4.0) severity = "orange";
        
        const formattedTime = new Date(eq.event_time).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit"
        });

        const subText = activeHistoryTab === "felt" ? (eq.dirasakan || eq.location_description) : `Kedalaman: ${eq.depth_km} km`;

        item.innerHTML = `
            <div class="history-mag-badge ${severity}">M ${eq.magnitude.toFixed(1)}</div>
            <div class="history-info">
                <h4>${eq.region || eq.location_description}</h4>
                <p>${subText}</p>
                <p style="font-size: 0.6rem; color: rgba(255,255,255,0.4); margin-top: 2px;">${formattedTime}</p>
            </div>
            <div class="history-chevron">❯</div>
        `;
        item.addEventListener("click", () => {
            renderDetailView(eq);
        });
        historyContainer.appendChild(item);
    });
}

function renderSettingsView() {
    const list = document.getElementById("settings-locations-list");
    list.innerHTML = "";

    userLocations.forEach(loc => {
        const item = document.createElement("div");
        item.className = "setting-loc-item";
        item.innerHTML = `
            <div class="setting-loc-info">
                <h4>${loc.name}</h4>
                <span>${loc.latitude.toFixed(3)}, ${loc.longitude.toFixed(3)}</span>
            </div>
            <div class="setting-loc-actions">
                <button class="btn-icon toggle-loc" data-id="${loc.id}">${loc.enabled ? '🟢' : '⚪'}</button>
                <button class="btn-icon delete-loc" data-id="${loc.id}">🗑️</button>
            </div>
        `;
        list.appendChild(item);
    });

    // Add event listeners to delete & toggle
    document.querySelectorAll(".toggle-loc").forEach(btn => {
        btn.addEventListener("click", async () => {
            const locId = parseInt(btn.getAttribute("data-id"));
            const currentLoc = userLocations.find(l => l.id === locId);
            await toggleLocation(locId, !currentLoc.enabled);
        });
    });

    document.querySelectorAll(".delete-loc").forEach(btn => {
        btn.addEventListener("click", async () => {
            const locId = parseInt(btn.getAttribute("data-id"));
            await deleteLocation(locId);
        });
    });
}

function renderDetailView(eq) {
    switchView("detail");
    const container = document.getElementById("detail-content-container");
    const isCritical = eq.magnitude >= 6.0 || (eq.tsunami_potential && eq.tsunami_potential.toLowerCase().includes("tsunami"));
    
    container.innerHTML = `
        <div class="detail-header-card ${isCritical ? 'critical' : ''}">
            <div class="detail-mag-circle">${eq.magnitude.toFixed(1)}</div>
            <div class="detail-title">${eq.region}</div>
            <div class="detail-subtitle">${new Date(eq.event_time).toLocaleString('id-ID')}</div>
        </div>

        <div class="detail-grid">
            <div class="detail-item-box">
                <span>Magnitudo</span>
                <strong>M ${eq.magnitude.toFixed(1)}</strong>
            </div>
            <div class="detail-item-box">
                <span>Kedalaman</span>
                <strong>${eq.depth_km} Km</strong>
            </div>
            <div class="detail-item-box">
                <span>Potensi</span>
                <strong style="color: ${isCritical ? 'var(--accent-red)' : 'var(--text-primary)'}">${eq.tsunami_potential || 'Tidak berpotensi'}</strong>
            </div>
            <div class="detail-item-box">
                <span>Koordinat</span>
                <strong>${eq.latitude.toFixed(2)}, ${eq.longitude.toFixed(2)}</strong>
            </div>
        </div>

        ${eq.dirasakan ? `
        <div class="felt-list-box">
            <h4>Wilayah Dirasakan (MMI)</h4>
            <div class="felt-regions">
                ${eq.dirasakan.split(",").map(part => `<span class="felt-tag">${part.trim()}</span>`).join("")}
            </div>
        </div>
        ` : ''}

        ${eq.shakemap_url ? `
        <div class="shakemap-preview-box">
            <h4 class="section-title">Peta Guncangan (Shakemap)</h4>
            <img class="shakemap-img" src="${eq.shakemap_url}" alt="Shakemap BMKG" onerror="this.src='https://placehold.co/300x150/111318/9ca3af?text=Gambar+Shakemap+BMKG'">
        </div>
        ` : ''}

        <div class="attribution-footer">
            Sumber Data Resmi: Badan Meteorologi, Klimatologi, dan Geofisika (BMKG) Terbuka.
        </div>
    `;
}

function renderDetailViewFromId(eventId) {
    const eq = feltEarthquakesList.find(x => x.bmkg_event_id === eventId) || 
               m5EarthquakesList.find(x => x.bmkg_event_id === eventId) ||
               (latestEarthquake && latestEarthquake.bmkg_event_id === eventId ? latestEarthquake : null);
    if (eq) {
        renderDetailView(eq);
    }
}

// Leaflet Map Visualizations
function initLeafletMap() {
    // If map container already has leaflet instance, remove it to re-initialize cleanly
    if (phoneMap) {
        phoneMap.remove();
        phoneMap = null;
    }
    
    // Centered around Indonesia
    phoneMap = L.map("phone-map").setView([-2.5, 118.0], 4);
    
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 10
    }).addTo(phoneMap);

    // Draw user active locations
    userLocations.forEach(loc => {
        if (!loc.enabled) return;
        const marker = L.circleMarker([loc.latitude, loc.longitude], {
            radius: 6,
            fillColor: "#1890ff",
            color: "#fff",
            weight: 1,
            fillOpacity: 1
        }).addTo(phoneMap);
        marker.bindPopup(`<b>${loc.name}</b><br>Lokasi Pantauan`);
        mapMarkers.push(marker);
    });

    // Draw earthquake epicenter if available
    if (latestEarthquake) {
        const mag = latestEarthquake.magnitude;
        const color = mag >= 6.0 ? "#ff4d4f" : (mag >= 4.0 ? "#fa8c16" : "#fadb14");
        
        // Episenter circle
        const circle = L.circle([latestEarthquake.latitude, latestEarthquake.longitude], {
            radius: getDistThresh(mag) * 1000, // meters
            color: color,
            fillColor: color,
            fillOpacity: 0.1,
            weight: 1.5
        }).addTo(phoneMap);
        
        const centerMarker = L.marker([latestEarthquake.latitude, latestEarthquake.longitude], {
            icon: L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 8px ${color}"></div>`,
                iconSize: [14, 14],
                iconAnchor: [7, 7]
            })
        }).addTo(phoneMap);

        centerMarker.bindPopup(`
            <b>Episenter Gempa</b><br>
            Wilayah: ${latestEarthquake.region}<br>
            Magnitude: M ${mag.toFixed(1)}<br>
            Kedalaman: ${latestEarthquake.depth_km} km
        `);

        mapCircles.push(circle);
        mapMarkers.push(centerMarker);
    }

    // Draw historical epicenters
    const plottedIds = new Set();
    if (latestEarthquake) plottedIds.add(latestEarthquake.bmkg_event_id);
    
    const allHistory = [...feltEarthquakesList, ...m5EarthquakesList];
    allHistory.forEach(eq => {
        if (plottedIds.has(eq.bmkg_event_id)) return;
        plottedIds.add(eq.bmkg_event_id);
        
        const mag = eq.magnitude;
        const color = mag >= 6.0 ? "#ff4d4f" : (mag >= 4.0 ? "#fa8c16" : "#fadb14");
        
        const histMarker = L.circleMarker([eq.latitude, eq.longitude], {
            radius: 4,
            fillColor: color,
            color: "#fff",
            weight: 0.5,
            fillOpacity: 0.6
        }).addTo(phoneMap);
        
        histMarker.bindPopup(`
            <b>${eq.region || eq.location_description}</b><br>
            Magnitude: M ${mag.toFixed(1)}<br>
            Kedalaman: ${eq.depth_km} km<br>
            Waktu: ${new Date(eq.event_time).toLocaleDateString()}<br>
            <a href="#" onclick="event.preventDefault(); renderDetailViewFromId('${eq.bmkg_event_id}');" style="color:#1890ff; font-weight:600; text-decoration:none; display:inline-block; margin-top:4px;">Lihat Detail</a>
        `);
        mapMarkers.push(histMarker);
    });

    // Fit bounds if user has locations, otherwise center on latest epicenter or Indonesia
    if (latestEarthquake) {
        if (userLocations.length > 0) {
            const group = new L.featureGroup([...mapCircles, ...mapMarkers]);
            phoneMap.fitBounds(group.getBounds().pad(0.1));
        } else {
            phoneMap.setView([latestEarthquake.latitude, latestEarthquake.longitude], 5);
        }
    } else if (mapMarkers.length > 0) {
        const group = new L.featureGroup(mapMarkers);
        phoneMap.fitBounds(group.getBounds().pad(0.1));
    }
}

// SSE Connection to stream notifications in real time
function connectSSE() {
    if (sseConnection) {
        sseConnection.close();
    }

    logConsole("Connecting to SSE notification stream...", "system");
    sseConnection = new EventSource(`${API_BASE}/api/v1/stream`);
    
    sseConnection.onopen = () => {
        logConsole("SSE connected. Real-time push listener active.", "info");
        document.getElementById("backend-status").className = "connection-status badge-active";
        document.getElementById("backend-status").innerText = "Backend: Connected";
        clearOfflineState();
        window.updateDashboardStats?.();
    };

    sseConnection.onerror = (e) => {
        logConsole("SSE Connection Error. Retrying in 10s...", "error");
        document.getElementById("backend-status").className = "connection-status badge-inactive";
        document.getElementById("backend-status").innerText = "Backend: Disconnected";
        sseConnection.close();
        setOfflineState();
    };

    sseConnection.addEventListener("push_notification", (event) => {
        const payload = JSON.parse(event.data);
        logConsole(`Incoming push notification event from SSE: ${JSON.stringify(payload)}`, "sse");
        
        // Verify it matches our installation ID and notifications are enabled
        if (payload.installation_id === installationId && isNotificationsEnabled) {
            triggerNotificationBanner(payload);
        }
    });
}

function triggerNotificationBanner(payload) {
    const banner = document.getElementById("push-notification-banner");
    const title = document.getElementById("banner-title");
    const text = document.getElementById("banner-text");
    
    const eq = payload.earthquake;
    const isCritical = payload.severity === "CRITICAL";
    
    title.innerText = `${isCritical ? '🚨 POTENSI TSUNAMI' : '🌋 Gempa Dirasakan'} M ${eq.magnitude.toFixed(1)}`;
    text.innerText = `${eq.region}. Dirasakan di ${payload.location_name}.`;
    
    banner.className = `push-banner active ${isCritical ? 'critical' : ''}`;
    banner.classList.remove("hidden");

    // Play notification sound / vibration representation
    logConsole(`[VIBRATION DING] Phone notification popped up!`, "warn");

    // Banner tap navigates directly to Detail View
    banner.onclick = () => {
        banner.classList.remove("active");
        renderDetailView(eq);
    };

    // Close banner button
    banner.querySelector(".banner-close").onclick = (e) => {
        e.stopPropagation(); // Prevent detail view click trigger
        banner.classList.remove("active");
    };

    // Auto dismiss after 8 seconds
    setTimeout(() => {
        banner.classList.remove("active");
    }, 8000);
}

// GPS mock setup inside simulated phone
function setupGPSButton() {
    const statusText = document.getElementById("gps-status-text");
    const gpsLat = document.getElementById("gps-lat");
    const gpsLng = document.getElementById("gps-lng");
    
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            currentGeoPosition = pos.coords;
            statusText.innerText = "Active";
            statusText.className = "success";
            gpsLat.innerText = currentGeoPosition.latitude.toFixed(4);
            gpsLng.innerText = currentGeoPosition.longitude.toFixed(4);
        },
        (err) => {
            // Default mock to Jakarta if browser permission denied
            currentGeoPosition = { latitude: -6.2088, longitude: 106.8456 };
            statusText.innerText = "Mocked (Jakarta)";
            statusText.className = "warning";
            gpsLat.innerText = currentGeoPosition.latitude.toFixed(4);
            gpsLng.innerText = currentGeoPosition.longitude.toFixed(4);
            logConsole("GPS access denied, defaulting mock current location to Jakarta.", "warn");
        }
    );

    document.getElementById("btn-save-gps").addEventListener("click", async () => {
        if (!currentGeoPosition) return;
        const name = document.getElementById("gps-loc-name").value || "Current Location";
        
        try {
            await addLocation({
                name: name,
                type: "current_location",
                latitude: currentGeoPosition.latitude,
                longitude: currentGeoPosition.longitude
            });
            hideModal("modal-add-location");
        } catch (e) {
            logConsole(`GPS location save error: ${e.message}`, "error");
        }
    });
}

// ManualDropdowns setup for provinces and cities hierarchy
function populateProvincesDropdown() {
    const dropdown = document.getElementById("select-province");
    dropdown.innerHTML = '<option value="">-- Pilih Provinsi --</option>';
    provincesList.forEach(prov => {
        dropdown.innerHTML += `<option value="${prov.id}">${prov.name}</option>`;
    });
}

function setupManualDropdowns() {
    const provSelect = document.getElementById("select-province");
    const citySelect = document.getElementById("select-city");
    const saveBtn = document.getElementById("btn-save-manual");
    
    provSelect.addEventListener("change", () => {
        const provId = parseInt(provSelect.value);
        citySelect.innerHTML = '<option value="">-- Pilih Kabupaten / Kota --</option>';
        saveBtn.disabled = !provId;
        
        if (!provId) {
            citySelect.disabled = true;
            return;
        }
        
        // Filter cities by province_id
        const filtered = citiesList.filter(c => c.province_id === provId);
        filtered.forEach(c => {
            citySelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
        
        citySelect.disabled = false;
    });

    citySelect.addEventListener("change", () => {
        const cityId = parseInt(citySelect.value);
        saveBtn.disabled = !provSelect.value;
        
        if (cityId) {
            const selectedCity = citiesList.find(c => c.id === cityId);
            document.getElementById("manual-loc-name").value = selectedCity.name;
        }
    });

    saveBtn.addEventListener("click", async () => {
        const cityId = parseInt(citySelect.value);
        const provId = parseInt(provSelect.value);
        const name = document.getElementById("manual-loc-name").value;
        const city = citiesList.find(c => c.id === cityId);
        const province = provincesList.find(p => p.id === provId);
        
        if (!province) return;
        
        try {
            await addLocation({
                name: name || city?.name || province.name,
                type: city ? "city" : "province",
                latitude: city?.latitude || province.latitude,
                longitude: city?.longitude || province.longitude,
                province_id: provId,
                city_id: city ? cityId : null
            });
            hideModal("modal-add-location");
        } catch (e) {
            logConsole(`Manual location save error: ${e.message}`, "error");
        }
    });
}

// REST helper requests for Locations
async function addLocation(payload) {
    if (userLocations.length >= 5) {
        alert("Batas maksimal 5 lokasi pantauan tercapai.");
        return;
    }
    
    const resp = await fetch(`${API_BASE}/api/v1/locations`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Installation-Id": installationId
        },
        body: JSON.stringify(payload)
    });
    
    if (resp.ok) {
        logConsole(`Added monitoring location: ${payload.name}`, "info");
        await fetchUserLocations();
        switchView(activeView); // Refresh current screen view
    } else {
        const err = await resp.json();
        alert(err.detail || "Gagal menambahkan lokasi");
    }
}

async function toggleLocation(locId, isEnabled) {
    const resp = await fetch(`${API_BASE}/api/v1/locations/${locId}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "X-Installation-Id": installationId
        },
        body: JSON.stringify({ enabled: isEnabled })
    });
    
    if (resp.ok) {
        logConsole(`Toggled location id=${locId} to ${isEnabled ? "Enabled" : "Disabled"}`, "info");
        await fetchUserLocations();
        renderSettingsView();
    }
}

async function deleteLocation(locId) {
    const resp = await fetch(`${API_BASE}/api/v1/locations/${locId}`, {
        method: "DELETE",
        headers: { "X-Installation-Id": installationId }
    });
    
    if (resp.ok) {
        logConsole(`Deleted location id=${locId}`, "info");
        await fetchUserLocations();
        renderSettingsView();
    }
}

// Offline UI handlers
function setOfflineState() {
    document.getElementById("app-state-title").innerText = "🔴 Offline Mode";
    document.getElementById("app-state-desc").innerText = lastSuccessfulUpdate ? `Update terakhir: ${lastSuccessfulUpdate}` : "Gagal memuat data BMKG";
    document.querySelector(".monitoring-status-card").style.borderColor = "var(--accent-red)";
    document.querySelector(".monitoring-status-card").style.background = "linear-gradient(135deg, rgba(255, 77, 79, 0.08) 0%, rgba(255, 77, 79, 0.02) 100%)";
    document.querySelector(".pulse-dot").style.backgroundColor = "var(--accent-red)";
    document.querySelector(".double-pulse").style.backgroundColor = "rgba(255, 77, 79, 0.4)";
}

function clearOfflineState() {
    document.getElementById("app-state-title").innerText = "🟢 Alert Active";
    document.getElementById("app-state-desc").innerText = "Memantau data resmi BMKG";
    document.querySelector(".monitoring-status-card").style.borderColor = "rgba(82, 196, 26, 0.15)";
    document.querySelector(".monitoring-status-card").style.background = "linear-gradient(135deg, rgba(82, 196, 26, 0.08) 0%, rgba(82, 196, 26, 0.02) 100%)";
    document.querySelector(".pulse-dot").style.backgroundColor = "var(--accent-green)";
    document.querySelector(".double-pulse").style.backgroundColor = "rgba(82, 196, 26, 0.4)";
}

// Utils & Helpers
function showModal(id) {
    document.getElementById(id).classList.remove("hidden");
}

function hideModal(id) {
    document.getElementById(id).classList.add("hidden");
}

function setupModalTabs() {
    document.querySelectorAll(".modal-tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const modal = btn.closest(".modal");
            modal.querySelectorAll(".modal-tab-btn").forEach(b => b.classList.remove("active"));
            modal.querySelectorAll(".modal-tab-content").forEach(c => c.classList.remove("active"));
            
            btn.classList.add("active");
            const tabId = btn.getAttribute("data-tab");
            modal.querySelector(`#tab-${tabId}`).classList.add("active");
        });
    });
}

function getHaversineDist(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function getDistThresh(mag) {
    if (mag >= 6.0) return 500;
    if (mag >= 5.0) return 250;
    if (mag >= 4.0) return 100;
    if (mag >= 3.0) return 50;
    return 0;
}

function checkMockFeltMatch(locName, feltStr) {
    if (!feltStr) return false;
    const cleanLoc = locName.toLowerCase().replace(/kabupaten|kab\.|kota/g, "").trim();
    const cleanFelt = feltStr.toLowerCase();
    return cleanFelt.includes(cleanLoc);
}

// Terminal Logging helper
function logConsole(message, type = "info") {
    const consoleBody = document.getElementById("terminal-body");
    const line = document.createElement("div");
    line.className = `log-line ${type}`;
    line.innerText = `[${new Date().toLocaleTimeString()}] [${type.toUpperCase()}] ${message}`;
    consoleBody.appendChild(line);
    consoleBody.scrollTop = consoleBody.scrollHeight;
}
window.logConsole = logConsole; // Make global for admin.js access
