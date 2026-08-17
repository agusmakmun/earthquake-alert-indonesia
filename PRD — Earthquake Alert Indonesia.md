# PRD — Earthquake Alert Indonesia

**Version:** 1.0
**Platform:** iOS & Android
**App Type:** Mobile Application
**Authentication:** Tidak ada login/register
**Primary Data Source:** BMKG Data Terbuka — Gempabumi
**Primary Goal:** Memberikan notifikasi gempa yang relevan dengan lokasi user secara cepat dan sederhana.

---

# 1. Product Summary

**Earthquake Alert Indonesia** adalah aplikasi mobile untuk iOS dan Android yang memonitor data gempa BMKG dan mengirimkan push notification kepada user ketika gempa terdeteksi dan berpotensi relevan dengan area yang dipantau user.

User tidak perlu:

* Login
* Register
* Email
* Password
* OTP

User cukup:

1. Menggunakan lokasi saat ini, atau
2. Memilih Provinsi/Kota/Kabupaten secara manual.
3. Mengaktifkan notifikasi.

User juga dapat menyimpan beberapa lokasi monitoring.

Contoh:

```text
Current Location
→ Jakarta

Additional Locations
→ Rumah — Sukabumi
→ Kantor — Jakarta
→ Keluarga — Yogyakarta
```

Jika terjadi gempa di Selat Sunda dan berdasarkan informasi BMKG gempa dirasakan di Jakarta, user yang memonitor Jakarta akan mendapatkan notification.

---

# 2. Important Product Positioning

Aplikasi ini **bukan aplikasi prediksi gempa**.

Aplikasi menggunakan data kejadian gempa dari BMKG dan memberikan alert setelah informasi gempa tersedia pada sistem BMKG.

Karena itu istilah produk yang digunakan:

**Earthquake Alert**

atau

**Notifikasi Gempa**

Bukan:

**Earthquake Prediction**

dan tidak boleh mengklaim:

> "Aplikasi dapat memprediksi gempa."

Untuk tahap MVP, aplikasi juga tidak boleh mengklaim sebagai sistem EEW beberapa detik sebelum gelombang gempa tiba.

---

# 3. Problem

Saat gempa terjadi, informasi biasanya tersedia melalui berbagai kanal, tetapi user harus secara aktif membuka aplikasi, website, atau media sosial.

Masalah:

1. User tidak tahu apakah suatu gempa relevan dengan dirinya.
2. User bisa berada jauh dari episentrum tetapi tetap merasakan gempa.
3. User mungkin ingin memonitor lokasi selain lokasi saat ini.
4. Informasi semua gempa dapat menyebabkan notification fatigue.
5. Aplikasi emergency tidak seharusnya membutuhkan proses login.
6. User membutuhkan informasi yang singkat dan langsung.

---

# 4. Product Goal

### Primary Goal

Memberikan notification hanya ketika terdapat gempa yang **relevan dengan lokasi yang dipantau user**.

### Secondary Goals

* Meminimalkan false alerts.
* Meminimalkan notification spam.
* Meminimalkan friction.
* Tidak membutuhkan account.
* Tetap ringan dan hemat baterai.
* Menggunakan sumber resmi BMKG.
* Menampilkan informasi gempa secara sederhana.

---

# 5. Target User

## Persona 1 — Current Location

User ingin mengetahui gempa yang relevan dengan lokasi tempat dia berada.

```text
Current Location
Jakarta
```

---

## Persona 2 — Specific Area

User ingin memonitor wilayah tertentu.

Contoh:

```text
Jakarta
Banten
Kabupaten Sukabumi
Yogyakarta
```

---

## Persona 3 — Multiple Locations

User ingin memonitor beberapa tempat.

Contoh:

```text
📍 Jakarta
🏠 Sukabumi
👨‍👩‍👧 Yogyakarta
🏢 Bandung
```

---

# 6. Core User Journey

```text
Install App
     ↓
Open App
     ↓
Choose Location
     │
     ├── Use Current Location
     │
     └── Select Area
     ↓
Allow Notifications
     ↓
Alert Activated
     ↓
Backend monitors BMKG
     ↓
Relevant earthquake detected
     ↓
Push Notification
     ↓
User opens detail
```

Tidak ada account creation.

---

# 7. First Launch

Screen:

```text
┌──────────────────────────────┐
│                              │
│             🌋               │
│                              │
│      EARTHQUAKE ALERT        │
│                              │
│  Dapatkan peringatan gempa   │
│  yang relevan dengan lokasi  │
│  Anda.                       │
│                              │
│ ┌──────────────────────────┐ │
│ │ 📍 Gunakan lokasi saya    │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ 🗺 Pilih lokasi           │ │
│ └──────────────────────────┘ │
│                              │
│ Data resmi: BMKG             │
└──────────────────────────────┘
```

---

# 8. Location Permission

Aplikasi tidak langsung meminta permission tanpa konteks.

Sebelum OS permission dialog:

```text
Gunakan lokasi Anda

Kami menggunakan lokasi untuk menentukan
apakah gempa berpotensi relevan dengan
area Anda.

Lokasi tidak digunakan untuk tracking
terus-menerus.

[ Izinkan Lokasi ]
```

Kemudian native OS permission muncul.

---

# 9. Current Location

Jika user memilih:

```text
Gunakan lokasi saya
```

aplikasi mendapatkan:

```text
latitude
longitude
```

Contoh:

```text
-6.2088
106.8456
```

Kemudian aplikasi melakukan reverse geocoding:

```text
Jakarta
DKI Jakarta
Indonesia
```

Location utama disimpan sebagai:

```text
Current Location
```

---

# 10. Manual Location

User dapat memilih:

```text
Pilih lokasi

[ Cari kota, kabupaten, provinsi ]

Indonesia
 ├── Aceh
 ├── Sumatera Utara
 ├── Sumatera Barat
 ├── ...
 └── Papua
```

Hierarchy:

```text
Provinsi
   ↓
Kota/Kabupaten
```

MVP tidak membutuhkan pemilihan kecamatan.

---

# 11. Monitoring Locations

Home screen menampilkan:

```text
Monitoring Locations

🟢 Current Location
   Jakarta

🏠 Rumah
   Kabupaten Sukabumi

👨‍👩‍👧 Keluarga
   Yogyakarta

[ + Tambah Lokasi ]
```

Setiap location dapat:

* Enable
* Disable
* Rename
* Delete

---

# 12. Location Limit

MVP:

**Maximum 5 monitoring locations per device.**

Contoh:

```text
1. Current Location
2. Jakarta
3. Sukabumi
4. Bandung
5. Yogyakarta
```

Alasan:

* cukup untuk mayoritas user
* mencegah abuse
* mengurangi kompleksitas
* mengurangi notification spam

Limit dapat diubah dari backend.

---

# 13. Notification Permission

Setelah lokasi berhasil dibuat:

```text
Aktifkan Notifikasi

Kami akan memberi tahu Anda jika gempa
terdeteksi dan relevan dengan lokasi
yang Anda pantau.

[ Aktifkan Notifikasi ]
```

Jika user menolak:

```text
Notifications: OFF
```

Aplikasi tetap dapat digunakan.

---

# 14. Home Screen

Home harus sangat sederhana.

```text
┌──────────────────────────────┐
│ Earthquake Alert             │
│                              │
│ 🟢 Alert Active              │
│                              │
│ Your Locations               │
│                              │
│ 📍 Jakarta                   │
│ 🏠 Sukabumi                  │
│                              │
│ ───────────────────────────  │
│                              │
│ Latest Relevant Earthquake   │
│                              │
│ 🌋 M 5.2                     │
│ Selat Sunda                  │
│ 17:20 WIB                    │
│                              │
│ Dirasa di Jakarta            │
│ III MMI                      │
│                              │
│ [ Lihat Detail ]             │
└──────────────────────────────┘
```

---

# 15. Mobile Navigation

Gunakan tiga tab utama:

```text
Home
Map
Settings
```

### Home

Gempa yang relevan dengan user.

### Map

Visualisasi gempa.

### Settings

Lokasi + notification + informasi aplikasi.

Jangan membuat navigation terlalu kompleks.

---

# 16. Map Screen

Menampilkan:

```text
Indonesia
```

dengan marker gempa.

Contoh:

```text
🔴 M 6.1
🟠 M 5.2
🟡 M 4.1

📍 Jakarta
📍 Sukabumi
```

Tap earthquake:

```text
M 5.2

Selat Sunda
20 km

[ Lihat Detail ]
```

---

# 17. Earthquake Detail

Screen:

```text
🌋 M 5.2

Selat Sunda

17 August 2026
17:20 WIB

Magnitude
5.2

Depth
20 km

Location
Selat Sunda

Coordinates
6.20 LS, 105.80 BT

Tsunami Potential
Tidak berpotensi

Felt Areas

Jakarta       III MMI
Banten        IV MMI
Sukabumi      III MMI

Source
BMKG

[ View Shakemap ]
```

---

# 18. BMKG Data

Primary data source:

**BMKG Data Terbuka — Gempabumi**

Data yang dapat digunakan meliputi:

* gempa terbaru
* gempa M5+
* gempa dirasakan
* informasi potensi tsunami
* shakemap

Data earthquake dinormalisasi oleh backend sebelum digunakan aplikasi.

---

# 19. Backend Architecture

Mobile app **tidak langsung mengakses BMKG**.

Architecture:

```text
BMKG
 │
 ▼
BMKG Ingestion Worker
 │
 ▼
PostgreSQL + PostGIS
 │
 ├─────────────┐
 ▼             ▼
Alert Engine   API
 │             │
 ▼             ▼
Push Service   Mobile App
 │
 ▼
iOS / Android
```

Alasan:

* rate limit BMKG
* konsistensi data
* deduplication
* monitoring
* scalability
* reliability

---

# 20. BMKG Polling

Backend memiliki worker:

```text
Earthquake Poller
```

Tugas:

1. Request data BMKG.
2. Parse response.
3. Validate data.
4. Generate normalized event.
5. Check apakah event sudah ada.
6. Insert/update event.
7. Trigger Alert Engine.

Polling interval harus configurable.

Contoh initial:

```text
15–30 seconds
```

Interval final harus disesuaikan dengan karakteristik update BMKG dan batas akses API.

---

# 21. BMKG Rate Limit

BMKG Data Terbuka memiliki batas akses.

Karena itu:

```text
100,000 users
```

tidak boleh menghasilkan:

```text
100,000 requests → BMKG
```

Yang benar:

```text
100,000 users
      │
      ▼
1 Backend
      │
      ▼
BMKG
```

---

# 22. Earthquake Data Model

```text
Earthquake

id
bmkg_event_id

event_time
latitude
longitude

magnitude
depth_km

location_description
region

tsunami_potential

felt_regions
mmi_data

shakemap_url

raw_data
created_at
updated_at
```

`bmkg_event_id` harus memiliki unique constraint.

---

# 23. Device Model

Karena tidak ada login:

```text
Device

id
installation_id
platform
push_token

app_version
os_version

created_at
updated_at
last_seen_at
```

Platform:

```text
ios
android
```

---

# 24. Monitoring Location Model

```text
MonitoringLocation

id
device_id

name

type

latitude
longitude

province_id
city_id
regency_id

enabled

created_at
updated_at
```

Type:

```text
current_location
province
city
regency
```

---

# 25. Notification Model

```text
NotificationLog

id

earthquake_id
device_id
location_id

severity
notification_type

sent_at
status

provider_message_id
```

Unique rule:

```text
earthquake_id
+
device_id
+
location_id
+
notification_type
```

untuk mencegah duplicate notification.

---

# 26. Alert Engine

Alert Engine menentukan apakah earthquake relevan.

Urutan:

```text
Earthquake
     ↓
BMKG Felt Area?
     │
     ├── YES → Match user location
     │
     └── NO
          ↓
     Geographic fallback
          ↓
     Distance calculation
          ↓
     Magnitude + depth rules
```

---

# 27. Alert Matching Priority

### Priority 1 — BMKG Felt Area

Jika BMKG memberikan:

```text
Jakarta — III MMI
```

dan user memiliki:

```text
Jakarta
```

→ ALERT.

Ini adalah matching utama.

---

### Priority 2 — Shakemap / Intensity Data

Jika informasi intensitas tersedia:

```text
User location
       ↓
Shakemap
       ↓
Estimated intensity
```

digunakan untuk meningkatkan akurasi.

---

### Priority 3 — Geographic Distance

Jika felt area tidak tersedia:

```text
Epicenter
    ↓
Distance
    ↓
User location
```

Gunakan Haversine/PostGIS.

---

### Priority 4 — Magnitude + Depth

Sebagai fallback terakhir.

Jangan menggunakan:

```text
M 5 = pasti terasa 100 km
```

karena persebaran guncangan bergantung pada banyak faktor.

---

# 28. Administrative Matching

Untuk user yang memilih:

```text
Jakarta
```

database memiliki polygon administratif Jakarta.

Untuk earthquake:

```text
BMKG Felt Area:
Jakarta
```

maka:

```text
Match = TRUE
```

Untuk user dengan current GPS:

```text
latitude
longitude
```

gunakan point-based matching.

---

# 29. Alert Severity

Gunakan tiga kategori:

### INFO

Gempa kecil dan tidak terdapat indikasi relevan terhadap user.

Tidak perlu push.

---

### WARNING

Gempa berpotensi dirasakan user.

Push notification.

---

### CRITICAL

Gempa kuat/signifikan atau informasi tsunami dari BMKG.

Push notification dengan prioritas lebih tinggi.

---

# 30. Notification Strategy

Jangan mengirim semua earthquake.

Default:

```text
Only potentially relevant earthquakes
```

Contoh:

```text
M 2.8
500 km dari Jakarta
```

→ No notification.

```text
M 5.2
Selat Sunda
Jakarta III MMI
```

→ Notification.

---

# 31. Notification Deduplication

Satu earthquake tidak boleh menghasilkan notification berulang.

Contoh:

```text
Earthquake ID:
BMKG-12345
```

Notification:

```text
sent
```

Jika data diperbarui:

```text
M 5.0 → M 5.1
```

tidak otomatis mengirim notification kedua.

Hanya kirim update jika perubahan dianggap signifikan.

---

# 32. Notification Example

### Normal Alert

```text
🌋 Gempa M 5.2

Selat Sunda
Kedalaman 20 km

Berpotensi dirasakan di Jakarta.

Sumber: BMKG
```

---

### Strong Earthquake

```text
🚨 Gempa Kuat

M 6.1 — Selat Sunda
Kedalaman 18 km

Area Jakarta berpotensi terdampak.

Ikuti informasi resmi BMKG.
```

---

### Tsunami

```text
🚨 POTENSI TSUNAMI

Gempa M 7.1
Selat Sunda

BMKG menyatakan gempa
berpotensi tsunami.

Ikuti arahan resmi BMKG.
```

Wording harus mengikuti informasi resmi BMKG dan tidak membuat interpretasi yang berlebihan.

---

# 33. Push Notification Architecture

```text
Backend
   ↓
Firebase Cloud Messaging
   │
   ├── Android → FCM
   │
   └── iOS → APNs via FCM
```

Device mendaftarkan push token.

Backend menyimpan:

```text
device_id
push_token
platform
```

---

# 34. Critical Notification

Tidak semua earthquake menggunakan emergency-level notification.

Recommended:

```text
Low earthquake
→ No notification

Potentially felt
→ Standard push

Strong/significant
→ High-priority push

Tsunami potential
→ Emergency-level notification
```

Untuk iOS, penggunaan fitur critical alert harus mengikuti capability/permission Apple yang berlaku.

Untuk Android, gunakan notification channel dengan importance yang sesuai.

---

# 35. Location Tracking

MVP **tidak menggunakan continuous GPS tracking**.

Jangan melakukan:

```text
GPS → every minute → backend
```

Cukup:

```text
Get Location
     ↓
Save current location
```

Lokasi dapat diperbarui:

* ketika user membuka aplikasi
* ketika user memilih refresh location
* bila diperlukan pada fase berikutnya dengan background location yang hemat baterai

Tujuan:

* privacy
* battery efficiency
* simpler permission
* simpler App Store review

---

# 36. Privacy

Aplikasi tidak membutuhkan:

* nama
* email
* nomor telepon
* password
* kontak
* address book

Data minimal:

```text
anonymous installation ID
push token
monitoring locations
```

Untuk current location, aplikasi harus menjelaskan penggunaan lokasi dengan jelas.

---

# 37. Offline Mode

Jika tidak ada koneksi:

```text
Last known data
```

tetap dapat ditampilkan.

Contoh:

```text
Last updated:
17:21 WIB

Tidak dapat terhubung ke server.
```

Aplikasi **tidak boleh** menampilkan:

> "Tidak ada gempa"

ketika data tidak berhasil diperbarui.

---

# 38. App States

### Healthy

```text
🟢 Monitoring Active
```

### Notification Disabled

```text
🟡 Notifications Disabled

Aktifkan notification
di Settings perangkat.
```

### Location Disabled

```text
🟡 Location unavailable

Gunakan lokasi manual
atau aktifkan location permission.
```

### Server unavailable

```text
🔴 Data temporarily unavailable

Last update:
17:21 WIB
```

---

# 39. Settings

Settings dibuat minimal:

```text
Settings

Notifications
🟢 ON

Monitoring Locations
────────────────────
📍 Jakarta
🏠 Sukabumi

Alert Sensitivity
● Potentially Felt
○ Moderate+
○ All Significant

Current Location
[ Update Location ]

About
BMKG Data Source

Privacy
Disclaimer
```

---

# 40. Alert Sensitivity

MVP dapat menyediakan:

### Potentially Felt

Default.

User hanya menerima earthquake yang relevan dengan area.

### Moderate+

Hanya gempa dengan intensitas/signifikansi tertentu.

### Significant

Gempa signifikan saja.

Jangan expose terlalu banyak parameter teknis seperti:

```text
radius = 127 km
magnitude > 4.2
depth < 50 km
```

Itu merupakan business logic backend.

---

# 41. Data Freshness

Setiap data earthquake harus memiliki:

```text
event_time
updated_at
received_at
```

UI:

```text
Gempa:
17:20 WIB

Data BMKG diterima:
17:20:15 WIB
```

Untuk user cukup tampilkan:

```text
17:20 WIB
```

Detail teknis dapat digunakan untuk monitoring internal.

---

# 42. Backend API

### Earthquakes

```http
GET /api/v1/earthquakes/latest
```

```http
GET /api/v1/earthquakes/{id}
```

### Device

```http
POST /api/v1/devices
```

```http
PATCH /api/v1/devices/{id}
```

### Push

```http
POST /api/v1/devices/{id}/push-token
```

### Locations

```http
GET /api/v1/locations
```

```http
POST /api/v1/locations
```

```http
PATCH /api/v1/locations/{id}
```

```http
DELETE /api/v1/locations/{id}
```

---

# 43. Device Registration

Saat first launch:

```text
Flutter
   ↓
Generate installation_id
   ↓
Register Device
   ↓
Request Notification Permission
   ↓
Get FCM token
   ↓
Send token to backend
```

Tidak ada user account.

---

# 44. Backend Worker

Pseudocode:

```python
while True:

    data = fetch_bmkg()

    events = normalize(data)

    for event in events:

        if is_new_event(event):

            save_event(event)

            locations = find_affected_locations(event)

            devices = get_devices(locations)

            for device in devices:

                if should_alert(event, device):

                    send_push(device, event)

                    log_notification(
                        event,
                        device
                    )

        elif has_significant_update(event):

            update_event(event)

            # Optional update notification

    sleep()
```

---

# 45. Geospatial Database

Gunakan:

**PostgreSQL + PostGIS**

Alasannya:

* geographic point
* polygon administratif
* radius query
* distance calculation
* spatial indexing

Contoh:

```text
Earthquake Point
       ↓
ST_DWithin()
       ↓
Monitoring Location
```

---

# 46. Administrative Data

Backend membutuhkan database wilayah Indonesia:

```text
Province
City
Regency
Polygon
```

Contoh:

```text
DKI Jakarta
 ├── Jakarta Pusat
 ├── Jakarta Utara
 ├── Jakarta Barat
 ├── Jakarta Selatan
 └── Jakarta Timur
```

MVP dapat menggunakan:

```text
Province
City/Regency
```

tanpa kecamatan.

---

# 47. Recommended Tech Stack

## Mobile

**Flutter + Dart**

Satu codebase:

```text
Flutter
 ├── iOS
 └── Android
```

---

## Backend

**Python + FastAPI**

Cocok untuk:

* BMKG ingestion
* geospatial calculation
* data processing
* worker
* API

---

## Database

**PostgreSQL + PostGIS**

---

## Push

**Firebase Cloud Messaging**

FCM menjadi push abstraction layer untuk Android dan iOS, dengan APNs digunakan di sisi Apple.

---

## Infrastructure

```text
Docker
PostgreSQL
Redis
FastAPI
Worker
```

Redis optional untuk queue/cache.

---

# 48. Backend Architecture

```text
                 ┌─────────────┐
                 │    BMKG     │
                 └──────┬──────┘
                        │
                        ▼
              ┌──────────────────┐
              │  BMKG Ingestion  │
              │      Worker      │
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │   PostgreSQL     │
              │    + PostGIS     │
              └────────┬─────────┘
                       │
              ┌────────┴────────┐
              ▼                 ▼
       ┌──────────────┐  ┌──────────────┐
       │ Alert Engine │  │   FastAPI    │
       └──────┬───────┘  └──────┬───────┘
              │                 │
              ▼                 ▼
       ┌──────────────┐   ┌──────────────┐
       │ FCM / APNs   │   │    Flutter   │
       └──────┬───────┘   └──────────────┘
              │
        ┌─────┴─────┐
        ▼           ▼
      Android      iOS
```

---

# 49. App Security

Karena tidak ada account, security fokus pada:

* device ID abuse prevention
* push token validation
* API rate limiting
* server-side validation
* HTTPS
* encrypted storage untuk sensitive device data
* tidak mempercayai location data dari client tanpa validation

API harus memiliki rate limiting.

---

# 50. Reliability

Karena ini aplikasi yang berhubungan dengan emergency information, backend harus memiliki monitoring.

Monitor:

```text
BMKG fetch status
BMKG response latency
Last successful BMKG fetch
Last earthquake received
Worker status
Alert engine status
Push success
Push failure
API health
```

Dashboard:

```text
BMKG
🟢 Healthy

Last fetch
17:21:32

Worker
🟢 Running

Push
🟢 Operational
```

---

# 51. Failure Handling

Jika BMKG gagal:

```text
BMKG
   ↓
ERROR
   ↓
Retry
   ↓
Backoff
```

Jangan mengirim:

```text
"Safe — no earthquake"
```

Sebaliknya:

```text
Data temporarily unavailable
```

---

# 52. Analytics

Analytics tidak digunakan untuk personal profiling.

Event yang boleh dicatat:

```text
app_open
location_added
location_removed
notification_permission_granted
notification_permission_denied
earthquake_detail_opened
map_opened
notification_opened
```

Tidak perlu mengumpulkan:

```text
nama
email
kontak
```

---

# 53. MVP Scope

## Must Have

* [ ] Flutter iOS app
* [ ] Flutter Android app
* [ ] No login/register
* [ ] Current location
* [ ] Manual province selection
* [ ] Manual city/regency selection
* [ ] Multiple monitoring locations
* [ ] Maximum 5 locations/device
* [ ] Push notification
* [ ] BMKG ingestion worker
* [ ] Earthquake database
* [ ] PostGIS
* [ ] Geographic matching
* [ ] BMKG felt-area matching
* [ ] Notification deduplication
* [ ] Earthquake detail
* [ ] Earthquake map
* [ ] Shakemap if available
* [ ] BMKG attribution
* [ ] Disclaimer
* [ ] Offline state
* [ ] Basic monitoring

---

# 54. Explicitly Out of Scope — MVP

Jangan implement:

* [ ] Login
* [ ] Register
* [ ] User profile
* [ ] Social network
* [ ] Comments
* [ ] Chat
* [ ] Community earthquake reports
* [ ] AI prediction
* [ ] Earthquake prediction
* [ ] Continuous GPS tracking
* [ ] Paid subscription
* [ ] Ads
* [ ] Complex earthquake analytics
* [ ] Earthquake forecasting

---

# 55. Phase 2

Setelah MVP stabil:

### Earthquake History

```text
24 Hours
7 Days
30 Days
```

### Advanced Map

* earthquake cluster
* magnitude visualization
* MMI visualization
* shakemap overlay

### Smart Alert

User dapat memilih:

```text
MMI ≥ III
MMI ≥ IV
MMI ≥ V
```

---

# 56. Phase 3

Native emergency capabilities:

```text
Critical Alert
Emergency Sound
Vibration
Lock Screen Alert
```

dengan tetap mengikuti capability dan policy iOS/Android yang berlaku.

Tambahkan juga:

```text
Background Location
```

hanya jika benar-benar dibutuhkan.

---

# 57. Future EEW Architecture

Jika suatu hari produk ingin benar-benar menjadi:

**Earthquake Early Warning**

arsitekturnya harus berbeda.

Bukan hanya:

```text
BMKG Earthquake Data
        ↓
Notification
```

tetapi membutuhkan:

```text
Real-time Seismic Sensors
        ↓
P-wave Detection
        ↓
Earthquake Detection
        ↓
Magnitude Estimation
        ↓
Location Estimation
        ↓
Expected S-wave Arrival
        ↓
User Location
        ↓
Seconds-level Warning
```

Jadi jangan mencampurkan kedua konsep tersebut dalam MVP.

---

# 58. Critical Product Principle

Aplikasi harus mengikuti prinsip:

> **Alert only when useful.**

Bukan:

> Alert every time an earthquake happens.

Contoh:

```text
Gempa M 3.0
Jauh dari Jakarta
        ↓
NO ALERT
```

Tetapi:

```text
Gempa M 5.2
Selat Sunda
        ↓
Jakarta III MMI
        ↓
ALERT
```

---

# 59. Example End-to-End Scenario

### Step 1

User install aplikasi.

```text
Earthquake Alert
```

---

### Step 2

User memilih:

```text
📍 Gunakan lokasi saya
```

GPS:

```text
Jakarta
```

---

### Step 3

User mengaktifkan notification.

```text
🟢 Alert Active
```

---

### Step 4

Backend mendapatkan event BMKG:

```text
M 5.2
Selat Sunda
Depth 20 km
```

---

### Step 5

BMKG data menunjukkan:

```text
Jakarta — III MMI
```

---

### Step 6

Alert Engine:

```text
User:
Jakarta

Earthquake:
Selat Sunda

BMKG Felt Area:
Jakarta

MATCH = TRUE
```

---

### Step 7

Backend mengirim FCM:

```text
🌋 Gempa M 5.2

Selat Sunda
Kedalaman 20 km

Berpotensi dirasakan di Jakarta.

Sumber: BMKG
```

---

### Step 8

User tap notification.

```text
Earthquake Detail
```

---

# 60. Definition of Done

MVP dinyatakan selesai apabila:

* [ ] Android dapat di-install.
* [ ] iOS dapat di-install.
* [ ] Tidak ada login/register.
* [ ] User dapat menggunakan current location.
* [ ] User dapat memilih provinsi.
* [ ] User dapat memilih kota/kabupaten.
* [ ] User dapat menyimpan beberapa lokasi.
* [ ] Notification permission dapat dikelola.
* [ ] Push notification berfungsi saat aplikasi ditutup.
* [ ] Backend mengambil data BMKG secara otomatis.
* [ ] Event BMKG tidak duplicate.
* [ ] Alert engine dapat menentukan lokasi yang terdampak/relevan.
* [ ] User hanya mendapatkan alert yang relevan.
* [ ] Satu event tidak menghasilkan spam notification.
* [ ] Detail gempa dapat dibuka.
* [ ] Map dapat menampilkan earthquake.
* [ ] Shakemap dapat ditampilkan jika tersedia.
* [ ] BMKG selalu dicantumkan sebagai sumber.
* [ ] Disclaimer tersedia.
* [ ] Tidak ada klaim earthquake prediction.
* [ ] Backend memiliki monitoring dan retry.
* [ ] App menangani kondisi offline.
* [ ] App tidak melakukan continuous GPS tracking pada MVP.

---

# 61. Final Product Definition

**Earthquake Alert Indonesia** adalah:

> Aplikasi mobile iOS dan Android tanpa login yang memonitor data gempa BMKG di backend dan mengirimkan push notification kepada user ketika gempa terdeteksi dan relevan dengan lokasi yang dipantau user.

Core loop:

```text
BMKG
 ↓
Detect Earthquake
 ↓
Determine Impact
 ↓
Match User Locations
 ↓
Push Notification
 ↓
User
```

**Kesederhanaan adalah fitur utama produk ini.**

User tidak perlu membuka aplikasi untuk mengetahui apakah gempa relevan. Ketika event yang relevan terdeteksi, sistem yang bekerja di belakang layar dan aplikasi cukup memberikan satu informasi penting:

**"Gempa terjadi — dan ini relevan dengan lokasi yang Anda pantau."**
