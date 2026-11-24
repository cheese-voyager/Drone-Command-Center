# Perubahan Backend: Telemetry P0–P2

Dokumen ini menjelaskan perubahan backend yang masuk dalam commit `f4ea919 feat: lengkapi schema telemetry mobile P0-P2`. Ditujukan untuk yang melanjutkan perawatan backend, terutama agar tahu field mana yang bertambah, dari pesan MAVLink mana, dan apa yang **tidak** berubah.

## 1. Ringkasan

Backend tetap memakai FastAPI, pymavlink, dan struktur service yang sudah ada. Payload `GET /status`, `WS /ws`, dan MQTT `status` diperluas dengan field telemetry baru sesuai `contracts/mobile-status.schema.json`.

| Aspek | Keterangan |
|---|---|
| Commit | `f4ea919` |
| File backend | 7 file |
| Perubahan | `+727/-18`, sekitar 295 baris di antaranya tests/mocks |
| Endpoint baru | Tidak ada |
| Dependency baru | Tidak ada |
| Perubahan `.env` | Tidak ada |
| Perubahan DB / file config | Tidak ada |
| Kompatibilitas | Field lama tetap ada; field baru bersifat tambahan |

Yang berubah di produksi hanya:

- `app/core/constants.py`
- `app/schemas/status.py`
- `app/schemas/__init__.py`
- `app/services/mavlink_client.py`
- `app/services/drone_service.py`

Sisanya adalah tests dan Pixhawk tiruan:

- `tests/mocks/fake_mavlink.py`
- `tests/test_status.py`

## 2. Apa yang tidak berubah

Tidak ada perubahan pada:

- `app/main.py`
- `app/api/*`
- `app/core/config.py`
- konfigurasi Mosquitto / ACL
- format request endpoint lain
- perilaku drop, thruster test, battery, seed, kamera, atau MQTT command

Jadi teammate tidak perlu menambah endpoint, migration, atau environment variable baru. Cukup restart proses backend setelah pull supaya parser baru aktif.

## 3. Field baru pada payload status

Semua field berikut dikirim lewat `GET /status`, `WS /ws`, dan MQTT `seeder/drone1/status` karena ketiganya memakai `DroneService.get_status()`.

`schema_version` tetap `1`.

### 3.1 P0 — Diagnostics / keselamatan

| Grup | Field | Sumber utama | Catatan |
|---|---|---|---|
| `time` | `boot_ms`, `utc` | `GLOBAL_POSITION_INT.time_boot_ms`, `_last_update` | `utc` adalah waktu backend menerima pesan, bukan waktu GPS |
| `power` | `source`, `battery_id`, `remaining_percent`, `energy_consumed_wh`, `energy_capacity_wh`, `cell_voltages_v`, `temperature_c`, `load_percent`, `usb_connected`, `power_brick_out` | `SYS_STATUS`, `BATTERY_STATUS`, `POWER_STATUS` | `source` bisa `SYS_STATUS`, `BATTERY_STATUS`, atau `mixed` |
| `health` | `ekf_ok`, `ekf_flags`, `sensor_present`, `sensor_enabled`, `sensor_health`, `vibration_x/y/z`, `clipping_events`, `comm_drop_rate`, `comm_errors`, `failsafe` | `EKF_STATUS_REPORT`, `VIBRATION`, `SYS_STATUS`, `STATUSTEXT` | `failsafe` dikumpulkan dari teks `STATUSTEXT` yang mengandung `failsafe`, `prearm`, atau `pre-arm` |
| `link` | `rssi`, `remrssi`, `noise`, `remnoise`, `rx_errors`, `fixed`, `txbuf_percent` | `RADIO_STATUS` | `packet_loss_percent`, `latency_ms`, dan `message_rates` belum diisi di `/status`; statistik pesan tetap ada di `/debug/mavlink` |
| `messages` | `time`, `severity`, `text`, `component` | `STATUSTEXT` | Disimpan maksimal 20 pesan terakhir |

Catatan:

- `health.prearm_ok` dan `power.energy_capacity_wh` sudah disiapkan di schema tetapi belum diisi backend. Jangan menganggap `null` sebagai PreArm gagal.
- `health.comm_drop_rate` dan `health.comm_errors` berasal dari `SYS_STATUS`, tetapi tidak semua firmware mengirim keduanya.

### 3.2 P1 — Navigasi dan misi

| Grup | Field | Sumber utama | Catatan |
|---|---|---|---|
| `gps` | `fix_type`, `satellites_visible`, `hdop`, `vdop`, `alt_msl_m`, `speed_mps`, `cog_deg`, `rtk_status` | `GPS_RAW_INT` | `rtk_status` = `fixed` untuk fix 6, `float` untuk fix 5, selain itu `none` |
| `nav` | `alt_amsl_m`, `alt_rel_m`, `alt_agl_m`, `alt_agl_source`, `airspeed_mps`, `groundspeed_mps`, `climb_mps`, `throttle_percent`, `heading_deg`, `cog_deg`, `vx_mps`, `vy_mps`, `vz_mps`, `wind_speed_mps`, `wind_direction_deg`, `wind_source` | `GLOBAL_POSITION_INT`, `ATTITUDE`, `VFR_HUD`, `WIND_COV` | `alt_agl_m` / `alt_agl_source` belum diisi karena belum ada sumber rangefinder/terrain |
| `mission` | `current_wp`, `total_wp`, `next_wp_lat`, `next_wp_lon`, `wp_distance_m`, `target_bearing_deg`, `nav_bearing_deg`, `nav_roll_deg`, `nav_pitch_deg`, `xtrack_error_m`, `state` | `MISSION_CURRENT`, `MISSION_COUNT`, `MISSION_ITEM_INT`, `NAV_CONTROLLER_OUTPUT`, `HEARTBEAT` | `state` diisi dari `flightmode`, fallback `IDLE` |
| `servo` | `channels[]`, `last_drop` | `SERVO_OUTPUT_RAW`, `COMMAND_ACK`, `set_servo()` | `last_drop` hanya terisi setelah ada `COMMAND_ACK` untuk `DO_SET_SERVO` |

Catatan servo:

- `channels` berisi PWM 1–16 yang tersedia di dialect pymavlink yang dipakai. Beberapa dialek hanya menyediakan `servo1_raw` sampai `servo8_raw`.
- Channel drop default tetap 9 dari `data/config.json`, tetapi field itu tidak dikirim ulang di payload status.
- `last_drop.ack_result` dipetakan dari `MAV_RESULT`: `ACCEPTED`, `REJECTED`, `FAILED`, `IN_PROGRESS`, `CANCELLED`, atau `UNKNOWN`.

### 3.3 P2 — Analytics

Tidak ada perubahan backend untuk P2. `telemetrySample` dan `flightSession` adalah definisi di `contracts/mobile-status.schema.json` yang dipakai aplikasi mobile untuk export JSON. Backend tidak menyimpan session dan tidak punya endpoint analytics baru.

## 4. Perubahan pada wrapper MAVLink

`REQUIRED_MESSAGE_IDS` sekarang:

```python
(1, 24, 30, 33, 36, 42, 44, 62, 73, 74, 109, 113, 125, 147, 193, 231, 253)
```

ID yang baru diminta dibanding sebelumnya:

| ID | Pesan | Digunakan untuk |
|---|---|---|
| 42 | `MISSION_CURRENT` | `mission.current_wp` |
| 44 | `MISSION_COUNT` | `mission.total_wp` |
| 62 | `NAV_CONTROLLER_OUTPUT` | jarak dan bearing waypoint |
| 73 | `MISSION_ITEM_INT` | koordinat waypoint berikutnya |
| 231 | `WIND_COV` | kecepatan dan arah angin |
| 253 | `STATUSTEXT` | daftar pesan status / failsafe |

`request_streams()` memakai `MAV_CMD_SET_MESSAGE_INTERVAL` untuk ID tersebut. Firmware yang tidak mendukung sebuah ID cukup mengabaikannya; field terkait akan tetap `null` atau kosong.

## 5. Perilaku penting di `DroneService`

- Posisi `0,0` tetap dibuang sebagai “belum ada GPS fix”; ini tidak berubah.
- `alt` lama tetap berasal dari `relative_alt` dalam meter. Field `nav.alt_rel_m` berisi angka yang sama, sedangkan `nav.alt_amsl_m` berasal dari `alt` MSL.
- `yaw` dan `nav.heading_deg` diisi dari `ATTITUDE`; `VFR_HUD.heading` bisa menimpanya saat tersedia.
- `gps_fix` / `satellites` lama tetap diisi dari `GPS_RAW_INT`, agar klien lama tidak rusak.
- `health.failsafe` dihitung ulang setiap `get_status()` dari daftar `messages`, bukan disimpan permanen.
- Saat koneksi MAVLink putus, `_detach_link()` mengosongkan `time`, `power`, `gps`, `nav`, `mission`, `health`, `link`, `servo`, dan `messages`, lalu menandai `connected = false`.
- HTTP dan WebSocket memakai snapshot status yang sama, jadi isi keduanya identik.
- `set_servo()` menyimpan channel/PWM terakhir. Saat `COMMAND_ACK` untuk `DO_SET_SERVO` masuk, data itu digabung dengan hasil ack menjadi `servo.last_drop`.

## 6. Cara verifikasi

Dari folder `backend/`:

```bash
python -m pytest -q --ignore=tests/test_mavlink.py
python -m ruff check app tests --exclude tests/test_mavlink.py
```

Hasil terakhir: `177 passed` dan `All checks passed!`.

`tests/test_mavlink.py` sengaja diabaikan karena masih berupa script lama yang membuka `COM3` dan memakai modul `serial` yang tidak tersedia di environment tes.

Setelah pull di Raspi / server:

```bash
cd seeder-drone/backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Lalu cek:

```bash
curl http://localhost:8000/status
curl http://localhost:8000/debug/mavlink
```

Pastikan `schema_version`, `power`, `gps`, `nav`, `mission`, `health`, `link`, `servo`, dan `messages` muncul. Field yang belum tersedia dari Pixhawk boleh bernilai `null` atau `[]`.

## 7. Catatan untuk yang melanjutkan

1. **Jangan hapus field lama.** Dashboard web lama dan klien MQTT lain masih memakai `lat`, `lon`, `alt`, `speed`, `gps_fix`, `satellites`, `battery`, `seed`, dan `motors`.
2. **Jika menambah field baru**, update `contracts/mobile-status.schema.json` dan `app/schemas/status.py` bersamaan.
3. **Jika menambah parsing pesan MAVLink**, tambahkan ID ke `REQUIRED_MESSAGE_IDS` hanya jika pesan itu memang perlu diminta aktif. Tambahkan factory ke `tests/mocks/fake_mavlink.py` dan test ke `tests/test_status.py`.
4. **Hati-hati dengan field `null`.** Banyak field baru kosong sampai Pixhawk mengirim pesan yang sesuai. Frontend harus menangani `null`.
5. **Statistik `/debug/mavlink` terpisah.** Jangan menyamakan `link.message_rates` di schema dengan `GET /debug/mavlink`; keduanya belum disatukan.
6. **Perubahan ini tidak perlu migrasi.** Cukup restart backend setelah deploy.
