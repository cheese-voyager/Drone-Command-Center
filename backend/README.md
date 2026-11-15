# Backend Drone Penebar Benih

Backend (Python + FastAPI) untuk drone **Pixhawk + Raspberry Pi + Mission Planner**.

Fitur:
- Monitor posisi (lat, long, altitude), IMU (pitch/roll/yaw), voltage, arus, GPS
- Hitung baterai sendiri (mAh terpakai, sisa %, estimasi waktu terbang) dengan **kapasitas baterai diisi manual**
- Hitung benih: dimuat, sudah di-drop, sisa
- Drop benih dengan **thrust dan durasi yang bisa diatur**
- Riwayat titik drop (lat, long) untuk ditampilkan di peta, **tersimpan walau backend di-restart**
- Tes thruster dan **stop darurat**
- Live preview kamera (MJPEG)
- **MQTT** (wajib): status dan event drop dikirim ke broker, perintah (drop, tes thruster, stop darurat, dll) diterima dari dashboard web atau aplikasi mobile

## Struktur

```
backend/
├── app/
│   ├── main.py              # membuat aplikasi FastAPI (create_app)
│   ├── api/                 # endpoint HTTP & WebSocket (tipis, hanya memanggil service)
│   ├── services/            # logika: drone, baterai, benih, drop, thruster, kamera, penyimpanan
│   ├── schemas/             # bentuk JSON request/response (pydantic)
│   └── core/                # config (.env), konstanta, exception, logger
├── data/                    # config.json (pengaturan) dan drops.json (riwayat drop)
├── logs/                    # backend.log
├── tests/                   # pytest + Pixhawk tiruan (tests/mocks)
├── requirements.txt
└── requirements-dev.txt
```

| Service | Fungsi |
|---|---|
| `mavlink_client.py` | Pembungkus pymavlink (koneksi, kirim perintah servo) |
| `drone_service.py` | Baca Pixhawk di background, rangkum jadi status |
| `battery_service.py` | Hitung mAh terpakai, sisa %, estimasi waktu terbang |
| `seed_service.py` | Hitung benih dimuat / terdrop / sisa |
| `thruster_service.py` | Nyalakan servo, timer otomatis mati, tes, stop darurat |
| `drop_service.py` | Drop benih: cek benih, jalankan thruster, catat titik drop |
| `camera_service.py` | Streaming kamera Raspi (picamera2) atau webcam (OpenCV) |
| `config_store.py` | Baca/tulis `config.json` dengan aman |
| `drop_history.py` | Simpan riwayat drop ke `drops.json` |
| `mqtt_service.py` | Kirim status/event ke broker MQTT, terima perintah, kirim hasilnya |

## Langkah 1: Siapkan Raspberry Pi

Butuh **Python 3.10 atau lebih baru** (Raspberry Pi OS Bookworm membawa 3.11).

```bash
# salin repo ini ke Raspi, lalu:
cd seeder-drone/backend
python3 -m venv venv --system-site-packages
source venv/bin/activate
pip install -r requirements.txt
sudo apt install python3-picamera2     # kalau pakai kamera Raspi
pip install mavproxy                   # pembagi data ke Mission Planner
```

> `--system-site-packages` dipakai supaya `picamera2` (terinstall lewat apt) bisa terbaca.
> Kalau pakai webcam USB, `picamera2` tidak perlu diinstall.

## Langkah 2: Sambungkan Pixhawk ke Raspi

- Kabel dari port **TELEM** Pixhawk ke pin UART Raspi (TX ke RX, RX ke TX, GND ke GND)
- Aktifkan serial di Raspi: `sudo raspi-config`, lalu Interface Options, Serial Port. Pilih login shell **No**, serial hardware **Yes**
- Di Mission Planner, set parameter port TELEM yang dipakai (contoh TELEM2): `SERIAL2_PROTOCOL = 2`, `SERIAL2_BAUD = 921` (921600)
- Untuk tegangan dan arus, Pixhawk harus memakai **power module** dan `BATT_MONITOR` sudah diset

## Langkah 3: Jalankan MAVProxy

MAVProxy membagi data Pixhawk ke dua tujuan: Mission Planner di laptop dan backend ini.

```bash
mavproxy.py --master=/dev/serial0 --baudrate=921600 \
  --out=udp:IP_LAPTOP:14550 --out=udp:127.0.0.1:14551
```

- Ganti `IP_LAPTOP` dengan IP laptop yang menjalankan Mission Planner
- Di Mission Planner pilih **UDP**, port **14550**, lalu Connect
- Backend ini membaca dari `127.0.0.1:14551`

## Langkah 4: Pasang broker MQTT (Mosquitto)

MQTT bekerja lewat **broker** (perantara pesan). Backend dan dashboard sama-sama tersambung ke broker, tidak langsung satu sama lain. Pasang Mosquitto di Raspi:

```bash
sudo apt install -y mosquitto mosquitto-clients

cd seeder-drone/iot/raspi/mosquitto
sudo cp seeder.conf /etc/mosquitto/conf.d/seeder.conf   # port 1883 (MQTT) + 9001 (WebSocket untuk browser)
sudo cp seeder.acl  /etc/mosquitto/seeder.acl           # siapa boleh baca/tulis topik apa

# Buat dua akun (akan ditanya password). Flag -c hanya untuk akun PERTAMA (membuat file baru).
sudo mosquitto_passwd -c /etc/mosquitto/seeder.passwd backend      # dipakai backend
sudo mosquitto_passwd    /etc/mosquitto/seeder.passwd dashboard    # dipakai dashboard & aplikasi
sudo chown mosquitto: /etc/mosquitto/seeder.passwd /etc/mosquitto/seeder.acl
sudo chmod 600 /etc/mosquitto/seeder.passwd /etc/mosquitto/seeder.acl

sudo systemctl enable mosquitto
sudo systemctl restart mosquitto
sudo systemctl status mosquitto        # harus "active (running)"
```

Lalu isi akun `backend` di `backend/.env`:

```
MQTT_USERNAME=backend
MQTT_PASSWORD=password-yang-tadi
```

Cek broker dari terminal Raspi (harus menampilkan `online` setelah backend jalan di Langkah 5):

```bash
mosquitto_sub -h localhost -u dashboard -P PASSWORD_DASHBOARD -t 'seeder/drone1/#' -v
```

> Hak akses ada di `seeder.acl`. Kalau kamu mengganti `MQTT_TOPIC_PREFIX` atau `MQTT_DEVICE_ID`, ganti juga `seeder/drone1` di file itu.

### Mode laptop (mengembangkan dashboard tanpa drone)

Tidak perlu Raspi. Di laptop, pasang Mosquitto ([mosquitto.org/download](https://mosquitto.org/download/), Windows: installer `.exe`), lalu jalankan dengan konfigurasi percobaan yang **tanpa login**:

```bash
# Linux / Mac
mosquitto -c iot/raspi/mosquitto/seeder-dev.conf -v
```
```powershell
# Windows (PowerShell, dari folder seeder-drone)
& "C:\Program Files\mosquitto\mosquitto.exe" -c iot\raspi\mosquitto\seeder-dev.conf -v
```

Di `backend/.env` kosongkan `MQTT_USERNAME`/`MQTT_PASSWORD` (biarkan diberi tanda `#`). Konfigurasi ini terbuka untuk semua orang di jaringan, jadi **jangan dipakai di drone yang sungguhan terbang**.

## Langkah 5: Jalankan backend

Di terminal lain di Raspi:

```bash
cd seeder-drone/backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Atau dari root repo: `./scripts/run-backend.sh`

Kalau di log tampil `Pixhawk terhubung!` dan `MQTT terhubung ke localhost:1883`, berarti berhasil.

Backend tetap mau jalan walau broker belum menyala: ia mencoba tersambung lagi sendiri (1 sampai 30 detik sekali) dan langsung bekerja begitu broker ada.

## Langkah 6: Coba

Dari laptop (satu jaringan dengan Raspi), buka browser:

- **http://IP_RASPI:8000/docs**: halaman untuk mencoba semua fitur dengan klik
- **http://IP_RASPI:8000/status**: semua data monitoring
- **http://IP_RASPI:8000/video**: live preview kamera
- **http://IP_RASPI:8000/mqtt**: status koneksi MQTT dan daftar topik (`connected` harus `true`)

## Daftar endpoint

| Endpoint | Fungsi |
|---|---|
| `GET /status` | Semua data (posisi, IMU, baterai, benih, rata-rata) |
| `WS /ws` | Data yang sama, real-time 5x per detik |
| `GET /mqtt` | Status koneksi ke broker MQTT dan daftar topik (dashboard memakainya untuk tahu harus subscribe ke mana) |
| `POST /battery` | Set baterai (**wajib setiap ganti baterai**) |
| `POST /seed/load` | Set jumlah benih yang dimuat |
| `POST /drop/config` | Atur thrust (%) dan durasi (detik) |
| `POST /drop` | Jalankan drop (mengurangi benih, dicatat di riwayat) |
| `POST /thruster/test` | **Tes thruster penebar benih atau motor/propeler 1-4** lewat field `target` (tidak mengurangi benih, tidak dicatat) |
| `POST /thruster/stop` | **Stop darurat** thruster |
| `GET /drops` | Riwayat titik drop |
| `GET /video` | Live preview kamera |

### Contoh pemakaian (curl)

```bash
# Ganti baterai: 6S 16000 mAh
curl -X POST http://IP_RASPI:8000/battery -H "Content-Type: application/json" \
  -d '{"capacity_mah": 16000, "cells": 6}'

# Isi 200 benih
curl -X POST http://IP_RASPI:8000/seed/load -H "Content-Type: application/json" \
  -d '{"loaded": 200}'

# Atur thrust 60% selama 2 detik
curl -X POST http://IP_RASPI:8000/drop/config -H "Content-Type: application/json" \
  -d '{"thrust_percent": 60, "duration_s": 2}'

# Drop!
curl -X POST http://IP_RASPI:8000/drop
```

### Format error

Error dikirim sebagai JSON `{"detail": "...", "code": "..."}`:

| Status | Kapan | Contoh `code` |
|---|---|---|
| `400` | Ditolak karena kondisi (Pixhawk belum terhubung, benih kurang, thruster sedang jalan) | `drone_not_connected`, `not_enough_seeds`, `busy` |
| `422` | Isi request di luar batas (thrust bukan 0-100, durasi bukan 0-10 detik, kapasitas ≤ 0) | (format standar FastAPI) |
| `502` | Perintah gagal terkirim ke Pixhawk | `mavlink_command_failed` |
| `503` | Kamera tidak ditemukan | `camera_unavailable` |

## Cara tes thruster

Tes dulu di darat, **baling-baling/pengaman terpasang sesuai kondisi aman, drone tidak boleh dalam keadaan siap terbang**.

1. Pastikan backend sudah menampilkan `Pixhawk terhubung!`
2. Buka `http://IP_RASPI:8000/docs`, cari **POST /thruster/test**, klik *Try it out*
3. Mulai dari nilai kecil:
   ```json
   {"thrust_percent": 20, "duration_s": 2}
   ```
4. Klik *Execute*. Thruster berputar 2 detik lalu berhenti sendiri.
5. Naikkan bertahap (20, 40, 60, ...) sampai ketemu nilai yang pas, lalu simpan lewat `POST /drop/config`.
6. Kalau ada yang tidak beres, langsung panggil **POST /thruster/stop** (tombol stop darurat).

Atau lewat curl:
```bash
curl -X POST http://IP_RASPI:8000/thruster/test -H "Content-Type: application/json" \
  -d '{"thrust_percent": 20, "duration_s": 2}'

curl -X POST http://IP_RASPI:8000/thruster/stop
```

Batas aman: durasi maksimal 10 detik, thrust 0-100%.

### Tes 4 motor/propeler penggerak

Field `target` memilih yang dites:

| `target` | Yang berputar |
|---|---|
| `seeder` (default) | Thruster penebar benih (servo drop) |
| `motor_1` ... `motor_4` | Satu motor penggerak (output 1-4 di Pixhawk) |
| `all_motors` | Motor 1, 2, 3, 4 **berurutan**, masing-masing `duration_s` detik |

```bash
curl -X POST http://IP_RASPI:8000/thruster/test -H "Content-Type: application/json" \
  -d '{"target": "motor_1", "thrust_percent": 10, "duration_s": 2}'
```

Aturan khusus tes motor (demi keselamatan):
- Hanya boleh saat drone **disarm** (kalau armed ditolak dengan `code: drone_armed`).
- Thrust maksimal **30%** (di atas itu ditolak). Thruster penebar benih tetap boleh sampai 100%.
- Memakai perintah `DO_MOTOR_TEST` MAVLink, sama seperti fitur Motor Test di Mission Planner. Pixhawk yang menghentikan motor setelah durasi habis, jadi motor tetap berhenti walau koneksi putus.
- `POST /thruster/stop` juga menghentikan tes motor.
- **Lepas semua baling-baling saat tes di meja.** Pixhawk punya syarat sendiri (safety switch, kalibrasi RC, dll). Kalau Pixhawk menolak, API tetap menjawab 200 tapi di log backend muncul peringatan `Pixhawk MENOLAK tes motor`. Cek di Mission Planner atau lewat `/status` bagian `motors`.

`/thruster/stop` mengembalikan `{"stopped": false}` kalau perintah stop **tidak berhasil terkirim** ke Pixhawk. Anggap thruster masih bisa menyala dan putuskan dayanya secara manual.

Kalau thruster tidak bereaksi, cek `servo_channel` di `data/config.json` dan pastikan `SERVOx_FUNCTION = 0` untuk channel itu.

## MQTT

### Cara kerjanya

```
Pixhawk ──MAVLink──> MAVProxy ──UDP──> Backend (FastAPI) ──MQTT 1883──> Broker Mosquitto
                                          │                                │      ▲
                                          │ REST + WS :8000                │      └── MQTT 1883 ── Aplikasi mobile
                                          ▼                                └───────── WebSocket 9001 ── Dashboard web
                                       Dashboard web (data awal, riwayat drop, video)
```

- Backend **mengirim** status drone 2x per detik ke `seeder/drone1/status`, dan event setiap ada drop.
- Backend **mendengarkan** perintah di `seeder/drone1/cmd/<perintah>`, menjalankannya lewat service yang sama dengan endpoint REST (jadi semua aturan keselamatan sama), lalu membalas di `seeder/drone1/response`.
- Browser tidak bisa memakai MQTT biasa (port 1883), jadi dashboard web memakai **MQTT lewat WebSocket** di port **9001**. Aplikasi mobile memakai port 1883.

### Daftar topik

Topik dasar `seeder/drone1` bisa diganti lewat `MQTT_TOPIC_PREFIX` dan `MQTT_DEVICE_ID`. Dashboard tidak perlu menulis nama topik manual: semuanya ada di `GET /mqtt`.

| Topik | Arah | QoS | Retained | Isi |
|---|---|---|---|---|
| `seeder/drone1/online` | backend → | 1 | ya | `online` atau `offline`. Otomatis `offline` kalau backend mati (Last Will) |
| `seeder/drone1/status` | backend → | 0 | tidak | JSON status lengkap, **sama persis dengan `GET /status`**, 2x per detik |
| `seeder/drone1/drop/event` | backend → | 1 | tidak | JSON satu titik drop, setiap ada drop (dari MQTT **maupun** REST) |
| `seeder/drone1/response` | backend → | 1 | tidak | Hasil setiap perintah |
| `seeder/drone1/cmd/<perintah>` | → backend | 1 | **jangan** | Perintah (tabel di bawah) |

### Daftar perintah

Payload berupa JSON. Aturan nilainya **sama dengan endpoint REST** yang bersangkutan.

| Topik (`seeder/drone1/...`) | Payload | Sama dengan REST |
|---|---|---|
| `cmd/drop` | kosong atau `{}` | `POST /drop` |
| `cmd/drop-config` | `{"thrust_percent": 60, "duration_s": 1.5}` (boleh salah satu) | `POST /drop/config` |
| `cmd/seed-load` | `{"loaded": 200}` | `POST /seed/load` |
| `cmd/battery` | `{"capacity_mah": 16000, "cells": 6, "min_safe_percent": 25}` | `POST /battery` |
| `cmd/thruster-test` | `{"target": "seeder", "thrust_percent": 20, "duration_s": 2}` | `POST /thruster/test` |
| `cmd/thruster-stop` | kosong atau `{}` | `POST /thruster/stop` |

Semua payload boleh ditambah `"request_id": "apa-saja"` (teks atau angka). Backend mengembalikannya di balasan, jadi kamu tahu balasan mana untuk perintah yang mana.

### Balasan (`seeder/drone1/response`)

Berhasil:
```json
{"cmd": "seed-load", "ok": true, "request_id": "web-1", "data": {"loaded": 200, "dropped": 0}}
```
Gagal (`code` dan `detail` sama seperti error REST):
```json
{"cmd": "drop", "ok": false, "request_id": "web-2", "error": {"code": "not_enough_seeds", "detail": "Benih tidak cukup"}}
```

| `code` | Arti |
|---|---|
| `drone_not_connected`, `not_enough_seeds`, `busy`, `drone_armed`, `invalid_parameter` | Sama dengan REST (status 400) |
| `mavlink_command_failed` | Perintah gagal terkirim ke Pixhawk |
| `validation_error` | Nilai di luar batas (misalnya thrust 150). `detail` menyebut field-nya |
| `invalid_payload` | Payload bukan JSON object |
| `unknown_command` | Nama perintah di topik tidak dikenal |
| `payload_too_large` | Payload lebih dari 4096 byte |
| `queue_full` | Terlalu banyak perintah menumpuk (maksimal 50) |
| `internal_error` | Kesalahan tak terduga, detailnya ada di log backend |

### Coba dari terminal

Ganti `PASSWORD` dengan password akun `dashboard` (di mode laptop, hapus `-u dashboard -P PASSWORD`).

```bash
# Terminal A: pantau semuanya
mosquitto_sub -h IP_RASPI -u dashboard -P PASSWORD -t 'seeder/drone1/#' -v

# Terminal B: kirim perintah
mosquitto_pub -h IP_RASPI -u dashboard -P PASSWORD -q 1 -t seeder/drone1/cmd/seed-load \
  -m '{"loaded": 200, "request_id": "tes-1"}'

mosquitto_pub -h IP_RASPI -u dashboard -P PASSWORD -q 1 -t seeder/drone1/cmd/drop-config \
  -m '{"thrust_percent": 60, "duration_s": 2}'

mosquitto_pub -h IP_RASPI -u dashboard -P PASSWORD -q 1 -t seeder/drone1/cmd/drop -m '{}'
mosquitto_pub -h IP_RASPI -u dashboard -P PASSWORD -q 1 -t seeder/drone1/cmd/thruster-stop -m '{}'
```

Di Windows, `mosquitto_pub.exe` dan `mosquitto_sub.exe` ada di folder instalasi Mosquitto (`C:\Program Files\mosquitto`). Kalau lebih suka tampilan grafis, pakai [MQTTX](https://mqttx.app/) atau MQTT Explorer: isi host, port 1883, username, password, lalu subscribe ke `seeder/drone1/#`.

### Perilaku yang perlu diketahui

- **Perintah retained selalu diabaikan.** Pesan retained disimpan broker dan dikirim ulang setiap backend tersambung. Kalau dijalankan, thruster bisa menyala sendiri setiap backend restart. Jangan kirim perintah dengan flag retained (`-r`).
- **Stop darurat tidak antre.** `cmd/thruster-stop` dijalankan langsung saat diterima. Perintah lain dijalankan satu per satu, berurutan.
- **Sesi bersih.** Setelah terputus lalu tersambung lagi, perintah lama yang tertahan tidak dikirim ulang oleh broker.
- **Backend mati mendadak** (listrik putus, proses dibunuh): broker otomatis menandai `online` menjadi `offline`. Kalau dimatikan normal, backend mengirim `offline` sendiri.
- **Broker mati**: backend tetap jalan, tersambung lagi sendiri begitu broker hidup, dan langganan perintah dibuat ulang otomatis.
- **Status 2x per detik, QoS 0.** Pesan status yang hilang tidak diulang, karena status baru datang sebentar lagi.
- `MQTT_COMMANDS_ENABLED=false` membuat backend hanya mengirim data. Cocok untuk layar monitoring yang tidak boleh mengendalikan drone.

### Keamanan

Siapa pun yang bisa mengirim ke `seeder/drone1/cmd/...` bisa **menyalakan thruster**. Karena itu:

1. **Jangan buka broker tanpa login** di jaringan yang dipakai orang lain. `seeder.conf` sudah mewajibkan login.
2. Pakai **akun terpisah** (`backend`, `dashboard`) dengan hak akses berbeda di `seeder.acl`. Akun `dashboard` tidak bisa memalsukan status, akun `backend` tidak bisa mengirim perintah.
3. Password di kode frontend **bisa dibaca siapa pun** yang membuka dashboard. Jadi akun `dashboard` memang sengaja dibatasi, dan tetap anggap dashboard hanya untuk jaringan drone (hotspot Raspi), bukan internet.
4. Kalau broker di luar jaringan lokal, aktifkan TLS (`MQTT_TLS=true`, dan di Mosquitto pakai `listener` dengan `cafile`/`certfile`/`keyfile`). Dashboard lalu memakai `wss://`.
5. Mosquitto **diam-diam membuang** pesan yang tidak diizinkan ACL (MQTT 3.1.1 tidak punya pesan penolakan). Kalau perintah dari dashboard tidak pernah dibalas, cek ACL dulu.

## Panduan Frontend (web dan mobile)

Bagian ini untuk yang membuat dashboard di folder `web/` atau aplikasi di `mobile/`. Folder itu masih kerangka kosong. Kode TypeScript/React di bagian 3 sampai 8 sudah **di-type-check (strict)**, dan klien MQTT-nya (`droneMqtt.ts`) sudah diuji berjalan terhadap broker, backend, dan simulator Pixhawk sungguhan. Contoh Flutter (bagian 9) belum pernah dijalankan: anggap itu titik awal, bukan kode final.

### 1. Pilih jalur komunikasi

Backend punya tiga jalur ke frontend. Dashboard memakai gabungannya:

| Jalur | Untuk apa | Catatan |
|---|---|---|
| **MQTT** (wajib) | Status real-time, event drop, **semua perintah** (drop, tes thruster, stop darurat, isi benih, ganti baterai) | Lewat broker, jadi dashboard web dan aplikasi mobile bisa jalan bersamaan dan melihat data yang sama |
| **REST** (`http://IP_RASPI:8000`) | `GET /drops` (riwayat drop saat halaman dibuka), `GET /mqtt` (cari tahu topik), `GET /video` (kamera), `/docs` | Tidak butuh broker |
| **WebSocket** (`WS /ws`) | Cadangan status real-time tanpa broker | Hanya baca. Tidak ada perintah |

Aturan praktis:
- **Data yang berubah terus** (posisi, baterai, benih, motor): dari MQTT `status`.
- **Aksi** (tombol Drop, STOP, simpan pengaturan): kirim lewat MQTT, tunggu balasannya.
- **Data sekali ambil** (riwayat drop lama): REST saat halaman dibuka, lalu tambah dari MQTT `drop/event`.
- **Video**: tag `<img>` ke `/video`. MQTT tidak cocok untuk video.

### 2. Jalankan tanpa drone

Dengan simulator, dashboard bisa dikembangkan tanpa drone. Buka tiga terminal.

```bash
# Terminal 1: broker (lihat "Mode laptop" di Langkah 4)
mosquitto -c iot/raspi/mosquitto/seeder-dev.conf -v

# Terminal 2: backend (dari folder backend/)
uvicorn app.main:app --reload

# Terminal 3: Pixhawk palsu (dari folder backend/). Mengirim posisi, baterai, 4 motor, dst.
python scripts/simulate_pixhawk.py
```

Windows: aktifkan environment dulu (`.venv\Scripts\activate`), sisanya sama.

Cek: `http://localhost:8000/mqtt` harus menampilkan `"connected": true`, dan `http://localhost:8000/status` menampilkan `"connected": true` (ini koneksi ke Pixhawk tiruan). Tanpa Terminal 3, `status.connected` bernilai `false`, dan `drop` ditolak dengan `drone_not_connected`. Itu juga berguna untuk menguji tampilan error.

### 3. Siapkan proyek web

```bash
cd web
npm install mqtt
```

Buat `web/.env.local` (jangan di-commit):

```
VITE_API_URL=http://192.168.4.1:8000
VITE_MQTT_USER=dashboard
VITE_MQTT_PASSWORD=password-akun-dashboard
```

Ganti alamat dengan IP Raspi (atau `http://localhost:8000` di mode laptop, dan kosongkan user/password).

Klien MQTT yang sudah jadi ada di **`web/src/api/droneMqtt.ts`**. Isinya:

| Bagian | Fungsi |
|---|---|
| `createDroneClient({apiUrl, username, password})` | Memanggil `GET /mqtt`, lalu tersambung ke broker lewat WebSocket (port `ws_port`), subscribe otomatis, dan subscribe ulang setiap tersambung kembali |
| `client.onStatus(cb)` | Dipanggil setiap status baru (2x per detik) |
| `client.onOnline(cb)` | `true`/`false`: apakah **backend** hidup (bukan Pixhawk) |
| `client.onDrop(cb)` | Dipanggil setiap ada drop baru |
| `await client.send("drop", {...})` | Kirim perintah dan **tunggu balasannya**. Mengembalikan `data` kalau berhasil, melempar `CommandError` (dengan `.code`) kalau ditolak, dan error biasa kalau backend tidak menjawab dalam 5 detik |
| Tipe `DroneStatus`, `DropRecord`, `MqttInfo` | Bentuk JSON, sama dengan yang dikirim backend |

Pakai langsung tanpa React:

```ts
import { createDroneClient, CommandError } from "./api/droneMqtt";

const drone = await createDroneClient({
  apiUrl: "http://192.168.4.1:8000",
  username: "dashboard",
  password: "...",
});

drone.onStatus((s) => console.log(s.lat, s.lon, s.battery.remaining_percent));
drone.onDrop((d) => console.log("benih jatuh di", d.lat, d.lon));

await drone.send("seed-load", { loaded: 200 });
await drone.send("drop-config", { thrust_percent: 60, duration_s: 1.5 });

try {
  await drone.send("drop");
} catch (e) {
  if (e instanceof CommandError) console.log(e.code, e.message); // "not_enough_seeds" ...
}
```

### 4. Hook React: `web/src/hooks/useDrone.ts`

Menyambungkan klien ke state React, membuang koneksi saat komponen dilepas, dan menandai data **basi** kalau tidak ada status 3 detik.

```ts
import { useEffect, useState } from "react";
import {
  createDroneClient,
  type DroneClient,
  type DroneStatus,
  type DropRecord,
} from "../api/droneMqtt";

const STALE_AFTER_MS = 3000; // tidak ada status 3 detik = anggap data basi

export function useDrone() {
  const [client, setClient] = useState<DroneClient | null>(null);
  const [status, setStatus] = useState<DroneStatus | null>(null);
  const [backendOnline, setBackendOnline] = useState(false);
  const [lastDrop, setLastDrop] = useState<DropRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastStatusAt, setLastStatusAt] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let closed = false;
    let current: DroneClient | null = null;

    createDroneClient({
      apiUrl: import.meta.env.VITE_API_URL,
      username: import.meta.env.VITE_MQTT_USER,
      password: import.meta.env.VITE_MQTT_PASSWORD,
    })
      .then((c) => {
        if (closed) {
          c.close(); // komponen sudah dilepas sebelum koneksi selesai
          return;
        }
        current = c;
        c.onStatus((s) => {
          setStatus(s);
          setLastStatusAt(Date.now());
        });
        c.onOnline(setBackendOnline);
        c.onDrop(setLastDrop);
        setClient(c);
      })
      .catch((e: Error) => setError(e.message));

    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      closed = true;
      current?.close();
      clearInterval(tick);
    };
  }, []);

  const stale = now - lastStatusAt > STALE_AFTER_MS;
  return { client, status, backendOnline, stale, lastDrop, error };
}
```

Pakai di halaman:

```tsx
const { client, status, backendOnline, stale, error } = useDrone();

if (error) return <p>Gagal tersambung: {error}</p>;
if (!client || !status) return <p>Menghubungkan...</p>;
```

Tampilkan **dua status berbeda**, jangan digabung:

| Penanda | Sumber | Artinya kalau salah |
|---|---|---|
| Backend | `backendOnline` dan `!stale` | Raspi mati, backend mati, atau broker putus. Data di layar sudah lama |
| Pixhawk | `status.connected` | Backend hidup tapi Pixhawk tidak mengirim data. Tombol drop dan tes thruster ditolak |

### 5. Panel tombol: `web/src/components/drop/DropPanel.tsx`

Contoh tombol **Simpan pengaturan**, **Drop**, dan **STOP DARURAT** dengan pesan error yang ramah. Ganti isi `DropButton.tsx` atau `DropConfigForm.tsx` di kerangka sesuai kebutuhan.

```tsx
import { useState } from "react";
import { CommandError, type DroneClient, type DroneStatus } from "../../api/droneMqtt";

// Kode error dari backend -> kalimat untuk operator
const ERROR_TEXT: Record<string, string> = {
  drone_not_connected: "Pixhawk belum terhubung",
  not_enough_seeds: "Benih tidak cukup, isi dulu benihnya",
  busy: "Thruster masih berjalan, tunggu sebentar",
  drone_armed: "Tes motor hanya boleh saat drone disarm",
  validation_error: "Nilai di luar batas",
  invalid_parameter: "Nilai tidak valid",
};

function errorMessage(e: unknown): string {
  if (e instanceof CommandError) return ERROR_TEXT[e.code] ?? `${e.code}: ${e.message}`;
  return (e as Error).message; // misalnya: backend tidak menjawab (timeout)
}

export function DropPanel({ client, status }: { client: DroneClient; status: DroneStatus }) {
  const [thrust, setThrust] = useState(60);
  const [duration, setDuration] = useState(1.5);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  async function run(label: string, action: () => Promise<unknown>) {
    setWorking(true);
    try {
      await action();
      setMessage(`${label}: berhasil`);
    } catch (e) {
      setMessage(`${label}: ${errorMessage(e)}`);
    } finally {
      setWorking(false);
    }
  }

  return (
    <section>
      <p>
        Benih sisa: {status.seed.remaining} / {status.seed.loaded}
      </p>
      <label>
        Thrust {thrust}%
        <input type="range" min={0} max={100} value={thrust}
               onChange={(e) => setThrust(Number(e.target.value))} />
      </label>
      <label>
        Durasi (detik)
        <input type="number" min={0.1} max={10} step={0.1} value={duration}
               onChange={(e) => setDuration(Number(e.target.value))} />
      </label>
      <button disabled={working}
              onClick={() => run("Simpan", () =>
                client.send("drop-config", { thrust_percent: thrust, duration_s: duration }))}>
        Simpan pengaturan
      </button>
      <button disabled={working || !status.connected}
              onClick={() => run("Drop", () => client.send("drop"))}>
        Drop benih
      </button>

      {/* Stop darurat: tidak pernah di-disable, tidak minta konfirmasi */}
      <button style={{ background: "crimson", color: "white" }}
              onClick={() => run("STOP", () => client.send("thruster-stop"))}>
        STOP DARURAT
      </button>
      <p>{message}</p>
    </section>
  );
}
```

Aturan tombol yang sebaiknya dipertahankan:
- **STOP DARURAT tidak pernah di-disable**, tidak minta konfirmasi, selalu terlihat di semua halaman.
- Tombol **Drop** dimatikan selama menunggu balasan (mencegah klik dobel). Backend juga menolak dengan `busy` kalau thruster masih jalan.
- Tampilkan `code` error sebagai kalimat manusia (tabel `ERROR_TEXT`), dan tampilkan error timeout sebagaimana adanya.

### 6. Peta dan riwayat drop: `web/src/hooks/useDrops.ts`

Riwayat lama dari REST, titik baru dari event MQTT. Pencegah dobel memakai `time` karena drop bisa terjadi saat `fetch` masih berjalan.

```ts
import { useEffect, useState } from "react";
import type { DropRecord } from "../api/droneMqtt";

const API = import.meta.env.VITE_API_URL;

/** Riwayat drop untuk peta: ambil yang lama lewat REST, tambah yang baru dari event MQTT. */
export function useDrops(lastDrop: DropRecord | null) {
  const [drops, setDrops] = useState<DropRecord[]>([]);

  useEffect(() => {
    fetch(`${API}/drops`)
      .then((r) => r.json())
      .then((old: DropRecord[]) =>
        // gabung dengan yang mungkin sudah masuk dari MQTT selama fetch berjalan
        setDrops((now) => [...old, ...now.filter((d) => !old.some((o) => o.time === d.time))]),
      )
      .catch(() => {}); // peta tetap jalan walau riwayat gagal diambil
  }, []);

  useEffect(() => {
    if (!lastDrop) return;
    setDrops((d) => (d.some((x) => x.time === lastDrop.time) ? d : [...d, lastDrop]));
  }, [lastDrop]);

  return drops;
}
```

Pemakaian: `const drops = useDrops(lastDrop)`, lalu gambar satu penanda per elemen `drops` (`lat`/`lon` bisa `null` kalau GPS belum ada, lewati yang `null`). Posisi drone sendiri dari `status.lat` dan `status.lon`.

### 7. REST dari frontend

Untuk data sekali ambil atau kalau mau memakai REST sebagai pengganti perintah MQTT:

```ts
const API = import.meta.env.VITE_API_URL;

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    // 400/502/503: detail = teks. 422 (nilai di luar batas): detail = daftar kesalahan FastAPI.
    const detail = body?.detail;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail ?? res.status));
  }
  return body as T;
}

// Contoh: await api("/seed/load", { method: "POST", body: JSON.stringify({ loaded: 200 }) });
```

CORS: backend mengizinkan semua origin secara default (`CORS_ORIGINS=*`). Isi `CORS_ORIGINS=http://IP_LAPTOP:5173` di `.env` kalau mau dibatasi. CORS hanya berlaku untuk REST, bukan MQTT.

Video kamera: `<img src={`${API}/video`} alt="kamera" />`. Kamera hanya bisa dibuka satu proses, dan kalau tidak ada kamera `/video` menjawab 503.

### 8. WebSocket `/ws` (cadangan tanpa broker)

```ts
import type { DroneStatus } from "../api/droneMqtt";

/** Cadangan tanpa broker: status real-time langsung dari backend (WS /ws), 5x per detik. */
export function watchStatus(host: string, onStatus: (s: DroneStatus) => void): () => void {
  let ws: WebSocket | null = null;
  let stopped = false;

  const connect = () => {
    ws = new WebSocket(`ws://${host}:8000/ws`);
    ws.onmessage = (e) => onStatus(JSON.parse(e.data));
    ws.onclose = () => {
      if (!stopped) setTimeout(connect, 2000); // sambung ulang otomatis
    };
  };
  connect();
  return () => {
    stopped = true;
    ws?.close();
  };
}
```

Isi pesannya sama dengan `status` di MQTT. Kalau halaman dibuka lewat `https://`, browser memblokir `ws://` (lihat jebakan di bawah).

### 9. Aplikasi mobile (Flutter)

Aplikasi native memakai **MQTT biasa di port 1883**, bukan WebSocket. Paket: `mqtt_client`.

```dart
import 'dart:convert';
import 'package:mqtt_client/mqtt_client.dart';
import 'package:mqtt_client/mqtt_server_client.dart';

const base = 'seeder/drone1';

Future<MqttServerClient> connectDrone(String host, String user, String pass) async {
  final client = MqttServerClient.withPort(host, 'app-${DateTime.now().millisecondsSinceEpoch}', 1883)
    ..keepAlivePeriod = 30
    ..autoReconnect = true
    ..logging(on: false);
  await client.connect(user, pass);

  client.subscribe('$base/status', MqttQos.atMostOnce);
  client.subscribe('$base/online', MqttQos.atLeastOnce);
  client.subscribe('$base/drop/event', MqttQos.atLeastOnce);
  client.subscribe('$base/response', MqttQos.atLeastOnce);

  client.updates!.listen((messages) {
    final msg = messages.first.payload as MqttPublishMessage;
    final text = MqttPublishPayload.bytesToStringAsString(msg.payload.message);
    final topic = messages.first.topic;
    if (topic == '$base/status') {
      final status = jsonDecode(text) as Map<String, dynamic>; // isi sama dengan GET /status
      // perbarui state di sini
    }
  });
  return client;
}

void sendCommand(MqttServerClient client, String cmd, Map<String, dynamic> body) {
  final payload = MqttClientPayloadBuilder()..addString(jsonEncode(body));
  client.publishMessage('$base/cmd/$cmd', MqttQos.atLeastOnce, payload.payload!);
}
```

Di emulator Android, alamat laptop adalah `10.0.2.2`, bukan `localhost`. Pemakaian `request_id` dan penanganan error sama seperti di web.

### 10. Jebakan yang sering terjadi

1. **Browser harus ke port WebSocket (9001), bukan 1883.** `createDroneClient` sudah memakai `ws_port` dari `GET /mqtt`. Kalau menulis manual: `ws://IP_RASPI:9001`.
2. **Halaman `https://` tidak boleh memakai `ws://`** (mixed content). Layani dashboard lewat `http://` di jaringan drone, atau pasang TLS di broker dan pakai `wss://`.
3. **Perintah tidak pernah dibalas (timeout)?** Hampir selalu: broker tidak jalan, login salah, atau akun `dashboard` tidak punya hak `write` ke `cmd/+` di `seeder.acl` (Mosquitto membuang diam-diam). Lihat `/var/log/mosquitto/mosquitto.log`.
4. **Data kosong padahal broker jalan?** Cek topik dasar. Kalau `MQTT_DEVICE_ID` diganti, ambil topik dari `GET /mqtt`, jangan ditulis tetap.
5. **Selalu kirim `request_id`** (`client.send` sudah melakukannya). Tanpa itu balasan tidak bisa dicocokkan kalau ada beberapa perintah berurutan atau beberapa dashboard terbuka. Semua dashboard melihat semua balasan di topik `response`.
6. **Subscribe ulang setiap tersambung kembali** (event `connect` di mqtt.js). Broker memakai sesi bersih, jadi langganan tidak diingat. `droneMqtt.ts` sudah melakukannya.
7. **Jangan kirim perintah dengan flag retained.** Backend akan mengabaikannya.
8. **`status.connected` bukan `backendOnline`.** Yang pertama: Pixhawk. Yang kedua: backend. Lihat tabel di bagian 4.
9. **Nilai bisa `null`**: `lat`, `lon`, `voltage`, `current`, `motors`, `estimated_minutes_left`, dan lainnya kosong kalau datanya belum ada (GPS belum fix, tidak ada power module). Selalu tangani `null`, jangan tampilkan `NaN`.
10. **Jangan menyimpan password dengan teks biasa di repo.** `.env.local` sudah di luar git. Ingat password tetap terbaca di browser (lihat bagian Keamanan).

### 11. Urutan membangun dashboard

1. Jalankan broker, backend, simulator (bagian 2). Pastikan `GET /mqtt` `connected: true`.
2. Pasang `mqtt`, salin `.env.local`, jalankan `useDrone()` dan **tampilkan `JSON.stringify(status)` mentah** dulu. Kalau angka bergerak, jalur data beres.
3. Buat kartu baterai, benih, GPS, IMU, motor dari field `status` (nama field = nama di `GET /status`).
4. Buat panel tombol (bagian 5), uji lewat simulator: terminal simulator menampilkan `>>> SERVO channel=9 pwm=...` saat tombol Drop ditekan.
5. Buat peta dan riwayat drop (bagian 6).
6. Tambah video `/video`.
7. Terakhir: uji dengan **backend dimatikan** (data harus ditandai basi), **broker dimatikan** (dashboard harus tersambung kembali sendiri), dan **Pixhawk tidak terhubung** (tombol harus menampilkan error yang jelas, bukan diam).

### Ringkasan: elemen UI → data atau perintah

| Elemen dashboard | Sumber / perintah |
|---|---|
| Posisi di peta, ketinggian, kecepatan | `status.lat`, `lon`, `alt`, `speed` |
| Gauge IMU | `status.pitch`, `roll`, `yaw` |
| Baterai (%, mAh, estimasi menit, peringatan) | `status.battery.*` (`low` = di bawah batas aman) |
| Voltase, arus | `status.voltage`, `status.current` |
| GPS | `status.gps_fix`, `status.satellites` |
| 4 motor | `status.motors[]` (`pwm`, `percent`) |
| Benih dimuat / terdrop / sisa | `status.seed.*` |
| Titik drop di peta | `GET /drops` + event `drop/event` |
| Form ganti baterai | `send("battery", {capacity_mah, cells, min_safe_percent})` |
| Form isi benih | `send("seed-load", {loaded})` |
| Slider thrust + durasi | `send("drop-config", {thrust_percent, duration_s})` |
| Tombol Drop | `send("drop")` |
| Tes thruster / motor | `send("thruster-test", {target, thrust_percent, duration_s})` |
| **STOP DARURAT** | `send("thruster-stop")` |
| Kamera | `<img src="http://IP_RASPI:8000/video">` |
| Penanda koneksi | `backendOnline` + `stale` (backend) dan `status.connected` (Pixhawk) |

## Pengaturan

### `data/config.json` (diubah lewat API, jarang perlu diedit manual)

- `servo_channel`: nomor output AUX di Pixhawk yang dipakai mekanisme drop (default 9). Di Mission Planner, set `SERVOx_FUNCTION = 0` untuk channel itu supaya bisa dikontrol manual.
- `pwm_min` / `pwm_max`: rentang sinyal PWM. Thrust 0% = `pwm_min`, 100% = `pwm_max`.
- `seeds_per_drop`: jumlah benih yang berkurang setiap kali drop.

Kalau ada key yang hilang, otomatis diisi nilai default. Kalau filenya rusak, disalin ke `config.json.corrupt` dan dibuat ulang dari default.

### Environment variable / `.env`

Salin `.env.example` menjadi `.env`. Semuanya opsional:

| Variabel | Default | Fungsi |
|---|---|---|
| `MAVLINK_CONN` | `udpin:127.0.0.1:14551` | Alamat MAVLink dari MAVProxy |
| `MAVLINK_ENABLED` | `true` | `false` = API jalan tanpa Pixhawk |
| `WS_INTERVAL_S` | `0.2` | Jeda kiriman `/ws` (detik) |
| `CORS_ORIGINS` | `*` | Origin dashboard, dipisah koma |
| `DATA_DIR` / `LOG_DIR` | `data/` / `logs/` | Lokasi penyimpanan |
| `CAMERA_INDEX` / `_WIDTH` / `_HEIGHT` / `_FPS` | `0` / `640` / `480` / `10` | Pengaturan kamera |
| `MQTT_ENABLED` | `true` | `false` = MQTT mati (REST dan WebSocket tetap jalan) |
| `MQTT_HOST` / `MQTT_PORT` | `localhost` / `1883` | Alamat broker |
| `MQTT_WS_PORT` | `9001` | Port WebSocket broker untuk browser. Hanya diberitahukan ke dashboard lewat `GET /mqtt` |
| `MQTT_USERNAME` / `MQTT_PASSWORD` | kosong | Login ke broker (sangat disarankan) |
| `MQTT_TLS` / `MQTT_CA_CERT` | `false` / kosong | Enkripsi koneksi ke broker. Kosongkan `MQTT_CA_CERT` untuk memakai CA bawaan sistem |
| `MQTT_TOPIC_PREFIX` / `MQTT_DEVICE_ID` | `seeder` / `drone1` | Topik dasar = `seeder/drone1`. Tanpa spasi dan tanpa `/ # + $` |
| `MQTT_CLIENT_ID` | `<device_id>-backend` | ID klien di broker (harus unik; dua klien ber-ID sama saling menendang) |
| `MQTT_PUBLISH_INTERVAL_S` | `0.5` | Jeda kirim status ke `<topik dasar>/status` |
| `MQTT_KEEPALIVE_S` | `30` | Interval ping ke broker (minimal 5) |
| `MQTT_COMMANDS_ENABLED` | `true` | `false` = hanya kirim data, perintah dari MQTT diabaikan |

## Pengembangan

```bash
pip install -r requirements-dev.txt
pytest            # semua tes, tidak butuh Pixhawk maupun kamera
ruff check .      # lint
```

Tes memakai Pixhawk tiruan (`tests/mocks/fake_mavlink.py`) dan broker MQTT tiruan (`tests/mocks/fake_mqtt.py`), jadi bisa jalan di laptop dan di CI tanpa hardware maupun broker. Tes yang tidak butuh MQTT otomatis memakai `MQTT_ENABLED=false` (diatur di `tests/conftest.py`).

Mengembangkan dashboard tanpa drone: jalankan dengan `MAVLINK_ENABLED=false uvicorn app.main:app --reload`. Semua endpoint tetap menjawab, tapi `connected` bernilai `false` dan `/drop` serta `/thruster/test` akan ditolak.

## Hal penting

1. **Lepas baling-baling dan uji mekanisme drop di darat dulu.**
2. **Panggil `POST /battery` setiap ganti baterai.** Itu yang me-reset hitungan mAh terpakai. Lakukan saat baterai penuh.
3. Hitungan baterai berdasarkan arus dari Pixhawk. Kalau power module belum terkonfigurasi, nilainya kosong (`null`). Saat data terputus, jeda tidak dihitung sebagai pemakaian.
4. Kamera hanya bisa dibuka satu proses. Kalau error, pastikan tidak ada program lain yang memakai kamera.
5. Kalau Pixhawk belum terhubung, `POST /drop` dan `POST /thruster/test` akan ditolak.
6. Saat backend dimatikan, servo otomatis dikembalikan ke PWM minimum.
7. **Perintah MQTT = kendali thruster.** Jangan buka broker tanpa login, dan jangan kirim perintah dengan flag retained (diabaikan backend).

## Perubahan dari versi awal (`seeder_drone/`)

- Perintah jalan berubah: `uvicorn main:app` menjadi `uvicorn app.main:app` (dari folder `backend/`).
- `requirements.txt` memakai `uvicorn[standard]`. Versi biasa tidak punya library WebSocket, sehingga `/ws` gagal.
- Pengaturan dibaca dari `data/config.json` (bukan `config.json` di folder kerja) dan ditulis atomik.
- Riwayat drop disimpan ke `data/drops.json`, tidak hilang saat restart.
- Heartbeat dari Mission Planner (lewat MAVProxy) diabaikan, supaya status `armed` tidak salah.
- Perintah "nyala" dikirim sebelum benih dikurangi. Kalau gagal terkirim, benih tidak berkurang.
- Pengecekan "sedang berjalan" bersifat atomik, jadi dua `POST /drop` cepat berturut-turut tidak bisa jalan bersamaan.
- Nilai di luar batas ditolak (thrust 0-100, durasi 0-10 detik, kapasitas baterai > 0), termasuk di `/drop/config` yang sebelumnya tidak divalidasi.
- `connected` ikut menjadi `false` saat koneksi MAVLink error, tidak tertinggal `true`.
- Ditambah CORS supaya dashboard di origin lain bisa mengakses API.
- Ditambah MQTT (`app/services/mqtt_service.py`): status dan event drop dikirim ke broker, perintah diterima dari broker. Memakai service yang sama dengan REST, jadi batas keselamatan sama. `GET /mqtt` memberi tahu dashboard topik dan port broker.
- `DropService` punya pendengar (`add_listener`) yang dipanggil setiap selesai drop. Dipakai MQTT untuk event, dan error di pendengar tidak menggagalkan drop.

## Troubleshooting

| Masalah | Solusi |
|---|---|
| Tidak muncul `Pixhawk terhubung!` | Cek MAVProxy sudah jalan, kabel TX/RX, dan baud rate |
| `voltage`/`current` kosong | Cek power module dan `BATT_MONITOR` di Pixhawk |
| `/video` mengembalikan 503 | Cek kamera dengan `rpicam-hello`, atau pastikan `picamera2` terinstall |
| `/ws` ditolak (404) | Pasang lewat `pip install -r requirements.txt` (butuh `uvicorn[standard]`, uvicorn biasa tidak punya library WebSocket) |
| Tidak bisa dibuka dari laptop | Pastikan laptop dan Raspi satu WiFi, dan server jalan dengan `--host 0.0.0.0` |
| Log tidak muncul di `logs/` | Cek folder `logs/` bisa ditulis; log tetap tampil di terminal |
| `GET /mqtt` menampilkan `connected: false` | Broker belum jalan (`sudo systemctl status mosquitto`), `MQTT_HOST`/`MQTT_PORT` salah, atau login salah. Log backend menunjukkan alasannya |
| Log `Broker MQTT menolak koneksi` | `MQTT_USERNAME`/`MQTT_PASSWORD` salah, atau akun tidak ada di `seeder.passwd` |
| Browser: `WebSocket connection failed` | Pakai port **9001** (bukan 1883), pastikan `listener 9001` + `protocol websockets` ada di konfigurasi Mosquitto, dan port tidak diblokir firewall |
| Dashboard menerima data tapi perintah tidak dibalas | Akun `dashboard` tidak punya `topic write seeder/drone1/cmd/+` di `seeder.acl` (Mosquitto membuang tanpa pesan). Cek `/var/log/mosquitto/mosquitto.log` |
| Log `Perintah retained ... diabaikan` | Ada pesan retained lama di topik `cmd/...`. Hapus dengan `mosquitto_pub -u ... -P ... -r -n -t seeder/drone1/cmd/NAMA` |
| `online` tetap `offline` padahal backend jalan | Ada dua klien memakai `MQTT_CLIENT_ID` yang sama (saling menendang), atau topik dasar berbeda |

## Yang belum ada (rencana berikutnya)

- Otomatis kembali (RTL) saat baterai rendah. Datanya sudah ada di `battery.low`, tinggal ditambah logikanya di `app/services/`.
- Dashboard web (peta, gauge, video jadi satu halaman) di folder `web/`. Klien MQTT-nya sudah ada (`web/src/api/droneMqtt.ts`), panduan membangunnya ada di bagian **Panduan Frontend**.
