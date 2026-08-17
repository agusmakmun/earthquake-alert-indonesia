// admin.js
// Logic for the developer control panel to trigger simulated earthquakes.

const PRESETS = {
    sunda_felt: {
        magnitude: 5.2,
        depth: 20,
        lat: -6.2000,
        lng: 105.8000,
        region: "Selat Sunda",
        desc: "Pusat gempa berada di laut 25 km barat daya Sumur",
        potensi: "Tidak berpotensi tsunami",
        felt: "III Jakarta, III Sukabumi, II Banten"
    },
    megathrust: {
        magnitude: 8.1,
        depth: 15,
        lat: -8.2000,
        lng: 110.1000,
        region: "Megathrust Jawa Tengah",
        desc: "Pusat gempa berada di laut 120 km Selatan Yogyakarta",
        potensi: "POTENSI TSUNAMI Waspada/Siaga",
        felt: "V Yogyakarta, IV Sukabumi, IV Jakarta, IV Bandung, III Surabaya"
    },
    wamena: {
        magnitude: 4.1,
        depth: 10,
        lat: -4.0950,
        lng: 138.9482,
        region: "Wamena",
        desc: "Pusat gempa berada di darat 10 km Tenggara Wamena",
        potensi: "Tidak berpotensi tsunami",
        felt: "III Wamena, II Jayawijaya"
    },
    unfelt: {
        magnitude: 3.4,
        depth: 35,
        lat: -3.8000,
        lng: 102.2000,
        region: "Bengkulu Selatan",
        desc: "Pusat gempa berada di laut 50 km Barat Bengkulu",
        potensi: "Tidak berpotensi tsunami",
        felt: ""
    }
};

document.addEventListener("DOMContentLoaded", () => {
    const presetSelect = document.getElementById("mock-presets");
    const magnitudeInput = document.getElementById("input-magnitude");
    const depthInput = document.getElementById("input-depth");
    const latInput = document.getElementById("input-lat");
    const lngInput = document.getElementById("input-lng");
    const regionInput = document.getElementById("input-region");
    const descInput = document.getElementById("input-desc");
    const potensiInput = document.getElementById("input-potensi");
    const feltInput = document.getElementById("input-felt");
    const triggerBtn = document.getElementById("btn-trigger-mock");
    const clearLogsBtn = document.getElementById("btn-clear-logs");

    // Handle Preset Changes
    presetSelect.addEventListener("change", () => {
        const val = presetSelect.value;
        if (!val || !PRESETS[val]) return;

        const p = PRESETS[val];
        magnitudeInput.value = p.magnitude;
        depthInput.value = p.depth;
        latInput.value = p.lat;
        lngInput.value = p.lng;
        regionInput.value = p.region;
        descInput.value = p.desc;
        potensiInput.value = p.potensi;
        feltInput.value = p.felt;

        window.logConsole(`Preset loaded: ${val.toUpperCase()} - ${p.region}`, "system");
    });

    // Handle Trigger Mock Earthquake
    triggerBtn.addEventListener("click", async () => {
        const payload = {
            magnitude: parseFloat(magnitudeInput.value),
            depth_km: parseInt(depthInput.value),
            latitude: parseFloat(latInput.value),
            longitude: parseFloat(lngInput.value),
            region: regionInput.value,
            location_description: descInput.value,
            tsunami_potential: potensiInput.value,
            dirasakan: feltInput.value || null
        };

        window.logConsole(`Triggering mock earthquake: M ${payload.magnitude} in ${payload.region}...`, "warn");

        try {
            const resp = await fetch(`${window.location.origin}/api/v1/mock/trigger`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (resp.ok) {
                const data = await resp.json();
                window.logConsole(`Success: Mock earthquake event created! Event ID: ${data.event.bmkg_event_id}`, "info");
                
                // Fetch latest data on the phone simulator
                if (window.fetchEarthquakeData && window.renderHomeView) {
                    await window.fetchEarthquakeData();
                    window.renderHomeView();
                    
                    // If map is currently active, re-draw it
                    if (window.activeView === "map" && window.initLeafletMap) {
                        window.initLeafletMap();
                    }
                }
            } else {
                const err = await resp.json();
                window.logConsole(`Failed to trigger earthquake: ${JSON.stringify(err)}`, "error");
            }
        } catch (e) {
            window.logConsole(`Network error triggering earthquake: ${e.message}`, "error");
        }
    });

    // Handle Clear Logs
    clearLogsBtn.addEventListener("click", () => {
        document.getElementById("terminal-body").innerHTML = '<div class="log-line system">[SYSTEM] Logs console cleared.</div>';
    });

    // Start polling stats
    setInterval(updateDashboardStats, 3000);
    updateDashboardStats();
});

// Update Developer Dashboard Stats Counter
async function updateDashboardStats() {
    try {
        const resp = await fetch(`${window.location.origin}/api/v1/admin/stats`);
        if (resp.ok) {
            const data = await resp.json();
            document.getElementById("stat-sse-clients").innerText = data.sse_clients;
            document.getElementById("stat-devices").innerText = data.devices;
            document.getElementById("stat-locations").innerText = data.locations;
        }
    } catch (e) {
        // Suppress console errors for stats requests if server restarting
    }
}
window.updateDashboardStats = updateDashboardStats; // Make global
