# Dokumentasi Perancangan Website (Dashboard Web)

Dokumen ini adalah blue-print tampilan dan arsitektur frontend dashboard web untuk
drone penebar benih. Semua keputusan desain di sini **berdasarkan backend yang sudah
ada** di `backend/` (FastAPI + MQTT) dan kerangka folder `web/` yang sudah disediakan.

Audience: tim frontend yang akan mengisi file kosong di `web/src/`.

---

## 1. Ringkasan

Dashboard web adalah antarmuka operasi tunggal untuk:

- Memantau telemetri drone secara real-time (posisi, ketinggian, IMU, GPS, baterai,
  benih, 4 motor).
- Mengendalikan drone: drop benih, tes thruster/motor, stop darurat.
- Mengisi data misi: baterai, benih, pengaturan drop.
- Memantau peta: posisi drone, jejak terbang, titik drop.
- Melihat video kamera dan diagnostik koneksi.

Komunikasi utama memakai **MQTT lewat WebSocket** (broker Mosquitto port 9001).
REST dipakai untuk data sekali ambil (`/drops`, `/mqtt`, `/video`, `/debug/mavlink`).
`WS /ws` dipakai sebagai cadangan bila broker tidak tersedia.

---

## 2. Sumber data backend

### 2.1 REST

Base URL default: `http://<IP_RASPI>:8000` (mode laptop: `http://localhost:8000`).

| Method | Path | Body | Response | Dipakai untuk |
|---|---|---|---|---|
| GET | `/status` | - | `DroneStatus` | Status awal/sekali ambil, cadangan |
| WS | `/ws` | - | `DroneStatus` (5x/detik) | Cadangan real-time tanpa broker |
| GET | `/mqtt` | - | `MqttInfo` | Topik, port WS broker, status koneksi |
| GET | `/drops` | - | `DropRecord[]` | Riwayat drop saat halaman dibuka |
| GET | `/video` | - | MJPEG stream | `<img src="{API}/video">` |
| GET | `/debug/mavlink` | - | `{connection, connected, has_link, messages[]}` | Halaman diagnostik |
| POST | `/battery` | `BatteryConfig` | `BatteryConfig` | Ganti baterai (reset mAh terpakai) |
| POST | `/seed/load` | `{loaded}` | `{loaded, dropped}` | Muat benih (reset hitungan drop) |
| POST | `/drop/config` | `{thrust_percent?, duration_s?}` | `DropConfig` | Simpan thrust + durasi drop |
| POST | `/drop` | - | `DropRecord` | Jalankan drop |
| POST | `/thruster/test` | `{target, thrust_percent, duration_s}` | `ThrusterTestResponse` | Tes thruster / motor 1-4 |
| POST | `/thruster/stop` | - | `{stopped}` | Stop darurat |

Error REST: `{"detail": "...", "code": "..."}`. Status `400` (ditolak kondisi),
`422` (nilai di luar batas, `detail` berupa array FastAPI), `502` (MAVLink gagal),
`503` (kamera tidak ada).

### 2.2 MQTT

Topik dasar default `seeder/drone1` (diberitahukan oleh `GET /mqtt`, jangan ditulis
manual). Browser hanya bisa memakai MQTT lewat WebSocket port `9001`.

| Topik | Arah | Isi |
|---|---|---|
| `<base>/online` | backend -> | `"online"` / `"offline"` (retained, Last Will) |
| `<base>/status` | backend -> | JSON `DroneStatus`, 2x/detik |
| `<base>/drop/event` | backend -> | satu `DropRecord` tiap ada drop |
| `<base>/response` | backend -> | hasil perintah (`cmd`, `ok`, `request_id`, `data`/`error`) |
| `<base>/cmd/<perintah>` | dashboard -> | payload JSON perintah |

Perintah yang diterima backend (payload sama dengan REST):

| Perintah | Payload |
|---|---|
| `drop` | `{}` |
| `drop-config` | `{thrust_percent, duration_s}` (boleh salah satu) |
| `seed-load` | `{loaded}` |
| `battery` | `{capacity_mah, cells, min_safe_percent}` |
| `thruster-test` | `{target, thrust_percent, duration_s}` |
| `thruster-stop` | `{}` |

Semua payload boleh ditambah `request_id` (klien `droneMqtt.ts` sudah menambahkannya
secara otomatis).

### 2.3 Bentuk data (kontrak)

`DroneStatus` (isi `GET /status`, `WS /ws`, dan `<base>/status`):

```json
{
  "connected": true,
  "mode": "AUTO",
  "armed": false,
  "lat": -6.2,
  "lon": 106.8,
  "alt": 12.5,
  "pitch": 1.2,
  "roll": -0.8,
  "yaw": 95.0,
  "speed": 3.4,
  "voltage": 22.2,
  "current": 4.1,
  "gps_fix": 3,
  "satellites": 12,
  "motors": [{ "id": 1, "pwm": 1500, "percent": 50.0 }],
  "battery": {
    "capacity_mah": 10000,
    "used_mah": 250.5,
    "remaining_mah": 9749.5,
    "remaining_percent": 97.5,
    "avg_current": 4.0,
    "estimated_minutes_left": 243.7,
    "low": false
  },
  "seed": { "loaded": 200, "dropped": 10, "remaining": 190 },
  "avg_speed": 3.1
}
```

`DropRecord`:

```json
{ "time": 1731763200.0, "lat": -6.2, "lon": 106.8, "thrust": 70, "duration": 1.5 }
```

Aturan penting:

- Banyak field bisa `null` (GPS belum fix, power module belum ada, `motors` belum ada).
  UI **wajib** menangani `null`, jangan menampilkan `NaN`/`undefined`.
- Dua status koneksi berbeda: `backendOnline` (broker/backend hidup) dan
  `status.connected` (Pixhawk mengirim data). Jangan digabung.
- `gps_fix`: 0 tidak ada GPS, 1 tidak ada fix, 2 2D, 3 3D, 4 DGPS, 5 RTK float, 6 RTK fixed.
- `battery.low` = `remaining_percent < min_safe_percent`.

---

## 3. Arsitektur frontend

### 3.1 Stack

- React + TypeScript (strict) + Vite.
- `mqtt` (klien MQTT browser, sudah dipakai di `web/src/api/droneMqtt.ts`).
- Router: `react-router-dom` (sesuai `src/routes/index.tsx`).
- State: Zustand (sesuai `src/store/`).
- Peta: Leaflet + `react-leaflet` (sesuai `src/components/map/`).
- Tes: Vitest + Testing Library (sesuai `web/tests/*.test.tsx`).

> `web/package.json` masih kosong. Daftar di atas adalah rekomendasi yang sesuai
> dengan nama file kerangka; versi final ditentukan saat bootstrap.

### 3.2 Struktur folder (sesuai kerangka yang ada)

```
web/src/
├── api/
│   ├── client.ts          # fetch REST: GET /status, /drops, /mqtt, /debug/mavlink
│   ├── droneMqtt.ts       # SUDAH ADA: klien MQTT + tipe
│   ├── endpoints.ts       # konstanta path REST
│   ├── types.ts           # tipe API (alias ke types/)
│   └── websocket.ts       # klien WS /ws cadangan
├── components/
│   ├── ui/                # primitive: Button, Card, Input, Slider, Modal,
│   │                      #           ConfirmDialog, Toast, Spinner
│   ├── layout/            # AppLayout, Sidebar, Topbar, ConnectionBadge
│   ├── telemetry/         # BatteryGauge, FlightTimeEstimate, GpsStatusCard,
│   │                      # ImuAttitude, AltitudeCard, VoltageCurrentCard
│   ├── map/               # DroneMap, DroneMarker, DropMarkers, FlightPath
│   ├── battery/           # BatteryForm
│   ├── seed/              # SeedCounter, SeedLoadForm
│   ├── drop/              # DropButton, DropConfigForm, DropHistoryTable
│   ├── thruster/          # EmergencyStopButton, ThrusterTestForm
│   └── video/             # LiveVideo
├── hooks/
│   ├── useBackendUrl.ts   # resolve API URL (env -> localStorage)
│   ├── useDroneStatus.ts  # klien MQTT -> state + stale detection
│   ├── useDropHistory.ts  # REST /drops + event drop/event, dedupe by time
│   └── useWebSocket.ts    # fallback WS /ws
├── store/
│   ├── droneStore.ts      # status, koneksi, drops, aksi kirim perintah
│   └── settingsStore.ts   # API URL, kredensial MQTT, preferensi UI
├── types/                 # drone.ts, battery.ts, seed.ts, drop.ts
├── utils/                 # constants.ts, format.ts, geo.ts
├── styles/                # variables.css, globals.css
├── routes/index.tsx       # definisi route
└── pages/                 # satu halaman per route
```

### 3.3 Alur data

```
                         +--------------------------+
   Pixhawk --MAVLink-->  | backend FastAPI :8000    |
                         |  - REST /status,/drops   |
                         |  - WS /ws                |
                         +-----------+--------------+
                                     |
                              MQTT broker :1883
                              WebSocket  :9001
                                     |
                         +-----------v--------------+
                         | browser: droneMqtt.ts     |
                         |  - onStatus (2 Hz)        |
                         |  - onOnline              |
                         |  - onDrop                |
                         |  - send(cmd) <-- tombol  |
                         +-----------+--------------+
                                     |
                         +-----------v--------------+
                         | droneStore (Zustand)      |
                         |  status, drops, stale,    |
                         |  backendOnline            |
                         +-----------+--------------+
                                     |
              +----------------------+---------------------+
              |                      |                     |
        komponen telemetri      peta & riwayat       form kontrol
        (BatteryGauge,          (DroneMap,            (DropButton,
         ImuAttitude,dll)        DropMarkers)          BatteryForm,dll)
```

Aturan pengambilan data:

- Data berubah terus -> MQTT `<base>/status`.
- Aksi (drop, tes, stop, simpan) -> MQTT `cmd/*`, tunggu `<base>/response`.
- Data sekali ambil -> REST saat mount (`/drops`, `/mqtt`).
- Video -> `<img src="{API}/video">`, bukan MQTT.
- `WS /ws` hanya cadangan baca, tanpa perintah.

---

## 4. Desain halaman dan routing

| Route | Page | Isi utama | Sumber data |
|---|---|---|---|
| `/` | `DashboardPage` | Ringkasan misi: koneksi, baterai, benih, GPS, altitude, IMU, motor, mini peta, tombol drop cepat | `status` |
| `/map` | `MapPage` | Peta penuh: posisi drone, jejak terbang, semua titik drop, ringkasan hitungan | `status.lat/lon`, `/drops`, `drop/event` |
| `/drop` | `DropControlPage` | `DropConfigForm`, `DropButton`, konfirmasi, sisa benih | `status.seed`, `cmd/drop-config`, `cmd/drop` |
| `/thruster` | `ThrusterTestPage` | `ThrusterTestForm` (target, thrust, durasi), bar motor, `EmergencyStopButton` | `status.motors`, `status.armed`, `cmd/thruster-test` |
| `/battery` | `BatteryPage` | `BatteryForm`, `BatteryGauge`, `VoltageCurrentCard`, `FlightTimeEstimate` | `status.battery`, `cmd/battery` |
| `/seed` | `SeedPage` | `SeedLoadForm`, `SeedCounter` | `status.seed`, `cmd/seed-load` |
| `/history` | `DropHistoryPage` | `DropHistoryTable`, peta titik drop, unduh CSV | `/drops`, `drop/event` |
| `/video` | `VideoPage` | `LiveVideo` | `<img src="{API}/video">` |
| `/settings` | `SettingsPage` | API URL, kredensial MQTT, info topik, preferensi tampilan | `GET /mqtt`, `settingsStore` |
| `*` | `NotFoundPage` | Halaman 404 + tautan ke dashboard | - |

### 4.1 Layout

`AppLayout` membungkus semua halaman:

```
+------------------------------------------------------------------+
| Topbar: [logo] [Sidebar toggle]   [Backend: online] [Pixhawk: OK] |
|          [ARMED badge]  [jam]            [STOP DARURAT]           |
+----------+-------------------------------------------------------+
| Sidebar  |                                                       |
| - Dashb. |                  <main> konten halaman                 |
| - Peta   |                                                       |
| - Drop   |                                                       |
| - Thrust |                                                       |
| - Baterai|                                                       |
| - Benih  |                                                       |
| - Riwayat|                                                       |
| - Video  |                                                       |
| - Setting|                                                       |
+----------+-------------------------------------------------------+
```

- `Topbar` selalu menampilkan `ConnectionBadge` (backend + Pixhawk), indikator
  `ARMED`, jam, dan `EmergencyStopButton` (selalu terlihat, tidak pernah
  di-disable, tidak minta konfirmasi).
- `Sidebar` menampilkan status backend di bagian bawah dan navigasi.
- `AppLayout` menampilkan `Toast` global dan banner bila data basi.

---

## 5. Desain komponen

### 5.1 Primitive (`components/ui/`)

| Komponen | Tujuan | Catatan |
|---|---|---|
| `Button` | Aksi umum | Varian `primary`, `secondary`, `danger`, `ghost`; loading & disabled |
| `Card` | Wadah panel | Judul + slot aksi |
| `Input` | Teks/angka | Label, error, suffix unit |
| `Slider` | Nilai kontinu | Min/max/step, label nilai sekarang |
| `Modal` | Dialog overlay | Focus trap, tutup dengan Esc |
| `ConfirmDialog` | Konfirmasi aksi | Dipakai untuk drop (bukan untuk STOP) |
| `Toast` | Umpan balik singkat | Varian sukses/error/info, auto-dismiss |
| `Spinner` | Indikator memuat | - |

### 5.2 Telemetri (`components/telemetry/`)

| Komponen | Data | Tampilan |
|---|---|---|
| `BatteryGauge` | `battery.remaining_percent`, `battery.low` | Gauge melingkar + Warna: >50 hijau, 25-50 kuning, <25 merah + ikon peringatan |
| `FlightTimeEstimate` | `battery.estimated_minutes_left` | Menit + caption "berkira" |
| `VoltageCurrentCard` | `voltage`, `current`, `battery.avg_current` | Tegangan (V), arus (A), rata-rata arus |
| `GpsStatusCard` | `gps_fix`, `satellites`, `lat`, `lon` | Nama fix + jumlah satelit; koordinat 6 desimal |
| `ImuAttitude` | `pitch`, `roll`, `yaw` | Artificial horizon sederhana atau tiga nilai numerik + gauge |
| `AltitudeCard` | `alt`, `speed`, `avg_speed` | Ketinggian (m), kecepatan (m/s) |

Semua kartu menampilkan `-` atau status "belum ada data" bila nilai `null`.

### 5.3 Peta (`components/map/`)

| Komponen | Data | Tampilan |
|---|---|---|
| `DroneMap` | - | Peta Leaflet, layer OSM, auto-center ke drone, zoom terkontrol |
| `DroneMarker` | `status.lat/lon`, `status.yaw` | Penanda drone dengan orientasi |
| `FlightPath` | riwayat `lat/lon` dari `status` | Polyline jejak terbang (frontend mengakumulasi) |
| `DropMarkers` | `drops[]` | Satu penanda per drop; popup waktu + thrust/durasi; lewati `lat/lon` null |

Catatan: backend **tidak** menyimpan jejak penerbangan, hanya titik drop. Jejak
dibentuk di frontend dari stream `status` (simpan di `droneStore`, batasi jumlah
titik, mis. 500).

### 5.4 Form dan kontrol

| Komponen | Field | Perintah |
|---|---|---|
| `BatteryForm` | `capacity_mah` (1-...), `cells` (1-14), `min_safe_percent` (0-100) | `cmd/battery` |
| `SeedLoadForm` | `loaded` (>=0) | `cmd/seed-load` |
| `DropConfigForm` | `thrust_percent` (0-100), `duration_s` (0.1-10) | `cmd/drop-config` |
| `DropButton` | - | `cmd/drop` (dengan `ConfirmDialog`) |
| `ThrusterTestForm` | `target`, `thrust_percent`, `duration_s` | `cmd/thruster-test` |
| `EmergencyStopButton` | - | `cmd/thruster-stop` (tanpa konfirmasi) |
| `SeedCounter` | - | Tampilan `loaded`/`dropped`/`remaining` + progress |
| `DropHistoryTable` | - | Tabel waktu, lat, lon, thrust, durasi + unduh CSV |
| `LiveVideo` | - | `<img>` ke `/video`, status error 503 |

### 5.5 Aturan tombol dan keselamatan (wajib diikuti)

- `EmergencyStopButton` **tidak pernah** disabled, tidak pakai `ConfirmDialog`,
  selalu terlihat di `Topbar` dan halaman kontrol. Warna merah mencolok.
- `DropButton` disabled selama `working` atau `!status.connected`; pakai
  `ConfirmDialog` ("Area drop aman, siap menebar?").
- `ThrusterTestForm`:
  - `target` `seeder`: thrust 0-100%.
  - `target` `motor_1`..`motor_4` / `all_motors`: thrust maksimal 30% (batas
    backend `MOTOR_TEST_MAX_PERCENT`), hanya boleh saat `armed === false`
    (tampilkan peringatan `drone_armed`), dan tampilkan centang
    "baling-baling sudah dilepas".
- Tombol yang mengirim perintah disabled selama menunggu balasan (`working`) untuk
  mencegah klik dobel; backend tetap menolak dengan `busy`.
- Setelah sukses/gagal, tampilkan `Toast` + pesan di halaman.

---

## 6. State dan hook

### 6.1 `droneStore` (Zustand)

Bentuk state (usulan):

```ts
interface DroneState {
  info: MqttInfo | null;
  client: DroneClient | null;
  status: DroneStatus | null;
  drops: DropRecord[];
  backendOnline: boolean;
  pixhawkConnected: boolean;
  stale: boolean;              // tidak ada status > 3 detik
  lastDrop: DropRecord | null;
  connecting: boolean;
  error: string | null;

  setClient(c: DroneClient): void;
  setSettings(p: {apiUrl: string; username?: string; password?: string}): void;
  send<T>(cmd: CommandName, body?: object): Promise<T>;   // wrapper client.send + error mapping
  resetDrops(): void;
}
```

`send` melempar `CommandError` dengan `code` dari backend; komponen menampilkan
teks manusia melalui `utils/constants.ts`.

### 6.2 `settingsStore` (Zustand + persist)

- `apiUrl` (default `import.meta.env.VITE_API_URL`)
- `username`, `password` (default env; **jangan** di-commit)
- `brokerHost` opsional
- preferensi: satuan, interval refresh, tema
- disimpan di `localStorage` kecuali kredensial MQTT (opsional, dengan catatan
  keamanan bahwa kredensial tetap terbaca di browser).

### 6.3 Hook

- `useBackendUrl()`: mengembalikan `{apiUrl, username, password, brokerHost}` dari
  `settingsStore` + env.
- `useDroneStatus()`: membuat klien (`createDroneClient`), mendaftarkan
  `onStatus`/`onOnline`/`onDrop`, mendeteksi `stale` (tidak ada status 3 detik),
  menutup klien saat unmount. Menampilkan `status`, `backendOnline`, `stale`,
  `lastDrop`, `error`.
- `useWebSocket()`: fallback `WS /ws`, auto-reconnect, dipakai bila MQTT mati.
- `useDropHistory(lastDrop)`: ambil `/drops` saat mount, tambah event `drop/event`,
  dedupe berdasarkan `time`.

---

## 7. Tipe data TypeScript (`types/`)

- `types/drone.ts`: `DroneStatus`, `MotorStatus`, `ConnectionInfo`.
- `types/battery.ts`: `BatteryStatus`, `BatteryConfig`.
- `types/seed.ts`: `SeedStatus`, `SeedConfig`.
- `types/drop.ts`: `DropRecord`, `DropConfig`, `DropConfigRequest`, `ThrusterTestRequest`,
  `ThrusterTestResponse`, `TestTarget`.

Tipe ini sebaiknya disalin dari `web/src/api/droneMqtt.ts` (yang sudah Strict
type-check) dan skema backend. `api/types.ts` menjadi pintu impor tunggal.

---

## 8. Util dan konstanta

- `utils/format.ts`: `fmtNumber`, `fmtPercent`, `fmtCoord` (6 desimal), `fmtDuration`,
  `fmtTime` (WIB), `fmtCsv` (unduh riwayat drop).
- `utils/geo.ts`: `distanceKm`, `bearing`, `mapBounds`, `isValidCoord`,
  `formatLatLon`.
- `utils/constants.ts`:
  - `ERROR_TEXT: Record<string, string>` -> kalimat error untuk operator, mis.
    `drone_not_connected: "Pixhawk belum terhubung"`,
    `not_enough_seeds: "Benih tidak cukup, isi dulu benihnya"`,
    `busy: "Thruster masih berjalan, tunggu sebentar"`,
    `drone_armed: "Tes motor hanya boleh saat drone disarm"`,
    `validation_error: "Nilai di luar batas"`.
  - `GPS_FIX_NAMES`, `TEST_TARGETS`, batas `THRUST_MAX_PERCENT=100`,
    `MOTOR_TEST_MAX_PERCENT=30`, `MAX_DURATION_S=10`.

---

## 9. Styling

`styles/variables.css` (design token):

- Warna: latar gelap (`--bg`, `--surface`, `--border`), teks (`--text`,
  `--text-muted`), aksi (`--primary`), bahaya (`--danger`), status
  (`--ok`, `--warn`, `--error`).
- Spasi, radius, shadow, font, breakpoint.
- Tema: default gelap (drone ground-station), dukungan terang bila diperlukan.

`styles/globals.css`: reset, `body`, layout (`AppLayout`, grid sidebar/main),
`Topbar`, kartu, tombol, form, tabel, badge, toast, responsif (sidebar jadi
drawer di layar kecil).

Aksesibilitas: kontras cukup, fokus terlihat, label form, `aria-live` untuk
status koneksi dan toast.

---

## 10. Pola interaksi dan error

Alur kirim perintah:

```
klik tombol -> setWorking(true) -> store.send(cmd, body)
   -> berhasil: Toast sukses + (opsional) update tampilan dari response
   -> gagal: CommandError -> ERROR_TEXT[code] -> Toast error
   -> timeout: "Backend tidak menjawab perintah ..." -> Toast error
   -> finally: setWorking(false)
```

Tabel pemetaan elemen UI ke data/perintah (ringkasan):

| Elemen | Sumber / perintah |
|---|---|
| Posisi, altitude, kecepatan | `status.lat/lon/alt/speed` |
| Gauge IMU | `status.pitch/roll/yaw` |
| Baterai | `status.battery.*` |
| Tegangan/arus | `status.voltage/current` |
| GPS | `status.gps_fix/satellites` |
| Motor | `status.motors[]` |
| Benih | `status.seed.*` |
| Titik drop | `/drops` + `drop/event` |
| Form baterai | `cmd/battery` |
| Form benih | `cmd/seed-load` |
| Slider thrust/durasi | `cmd/drop-config` |
| Tombol Drop | `cmd/drop` |
| Tes thruster/motor | `cmd/thruster-test` |
| Stop darurat | `cmd/thruster-stop` |
| Kamera | `<img src="{API}/video">` |
| Status koneksi | `backendOnline` + `stale` (backend), `status.connected` (Pixhawk) |

---

## 11. Lingkungan dan build

`web/.env.example`:

```
VITE_API_URL=http://<IP_RASPI>:8000
VITE_MQTT_USER=dashboard
VITE_MQTT_PASSWORD=<password-akun-dashboard>
# VITE_MQTT_BROKER_HOST=   # opsional, bila broker berbeda dari host backend
```

- Build: `npm run build` (Vite) -> statis, bisa disajikan dari mana saja.
- Dev: `npm run dev` (port 5173) dengan proxy/ CORS backend (`CORS_ORIGINS=*`
  default; bisa dibatasi lewat `.env` backend).
- Mode tanpa drone: jalankan broker + backend + `scripts/simulate_pixhawk.py`.

---

## 12. Pengujian (`web/tests/`)

- `format.test.ts`: format angka, koordinat, waktu, CSV.
- `api.test.ts`: `droneStore.send` / pemetaan error dengan klien palsu.
- `BatteryGauge.test.tsx`: rendering, ambang warna, penanganan `null`/`low`.
- Tambahan yang disarankan: `geo.test.ts`, `useDropHistory.test.ts` (dedupe),
  `EmergencyStopButton.test.tsx` (selalu aktif).

---

## 13. Catatan kesesuaian dengan backend (gap yang perlu diketahui)

1. **Belum ada `GET /drop/config`.** Untuk menampilkan thrust/durasi sekarang saat
   halaman dibuka, frontend tidak bisa memintanya. Pilihan:
   - (a) backend menambah `GET /drop/config` (paling bersih), atau
   - (b) frontend memakai nilai default (`thrust_percent=70`, `duration_s=1.5`)
       lalu me-refresh setelah `cmd/drop-config` sukses, dan menyimpannya di
       `settingsStore`.
   Sementara desain ini memakai opsi (b) + mencatat rekomendasi (a).
2. **`servo_channel`, `pwm_min/max`, `seeds_per_drop` tidak bisa diubah lewat API.**
   Hanya lewat `backend/data/config.json`. Halaman `SettingsPage` sebaiknya
   menampilkannya sebagai info read-only, bukan form.
3. **`seeds_per_drop` tetap 1** dan tidak divalidasi jauh di frontend; backend
   menolak drop bila `remaining < seeds_per_drop` (`not_enough_seeds`).
4. **Kamera hanya satu klien.** Bila stream dipakai di dua halaman/komponen,
   gambar bisa rusak; tampilkan satu sumber saja.
5. **MQTT `host` dari `GET /mqtt` bisa `localhost`.** `droneMqtt.ts` sudah
   mengganti `localhost`/`127.0.0.1` dengan hostname `apiUrl`; jangan menulis
   ulang logika ini.
6. **Kredensial MQTT di frontend bisa dibaca siapa pun** yang membuka dashboard.
   Gunakan akun `dashboard` dengan ACL terbatas dan jaringan drone saja.

---

## 14. Urutan pengerjaan (saran)

1. Bootstrap `web/`: `package.json`, Vite, React, router, Zustand, Leaflet, Vitest.
2. Isi `api/`, `types/`, `utils/`, `styles/`.
3. Primitive UI + `AppLayout` + `Topbar`/`Sidebar`/`ConnectionBadge` +
   `EmergencyStopButton`.
4. `droneStore` + `useDroneStatus` + `useDropHistory`, tampilkan status mentah
   untuk verifikasi jalur data.
5. Halaman `DashboardPage` (telemetri + mini peta + drop cepat).
6. Halaman kontrol: `DropControlPage`, `ThrusterTestPage`, `BatteryPage`,
   `SeedPage`.
7. Halaman `MapPage` + `DropHistoryPage` + `FlightPath` + CSV.
8. Halaman `VideoPage` + `SettingsPage`.
9. Uji skenario: backend mati, broker mati, Pixhawk tidak terhubung, drop ditolak.
10. Lint + type-check + test.
