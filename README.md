# Backend Drone Penebar Benih

Backend sederhana (Python) untuk drone **Pixhawk + Raspberry Pi + Mission Planner**.

Fitur:
- Monitor posisi (lat, long, altitude), IMU (pitch/roll/yaw), voltage, arus, GPS
- Hitung baterai sendiri (mAh terpakai, sisa %, estimasi waktu terbang) dengan **kapasitas baterai diisi manual**
- Hitung benih: dimuat, sudah di-drop, sisa
- Drop benih dengan **thrust dan durasi yang bisa diatur**
- Riwayat titik drop (lat, long) untuk ditampilkan di peta
- Live preview kamera (streaming saja)

## Isi project

| File | Fungsi |
|---|---|
| `main.py` | Server API (endpoint yang dipanggil dashboard) |
| `drone.py` | Baca Pixhawk, hitung baterai, kontrol drop |
| `camera.py` | Streaming kamera |
| `config.json` | Pengaturan tersimpan (baterai, drop, benih) |
| `requirements.txt` | Daftar library |

## Langkah 1: Siapkan Raspberry Pi

```bash
# salin folder ini ke Raspi, lalu:
cd seeder_drone
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

## Langkah 4: Jalankan backend

Di terminal lain di Raspi:

```bash
cd seeder_drone
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
```

Kalau tampil `Pixhawk terhubung!`, berarti berhasil.

## Langkah 5: Coba

Dari laptop (satu jaringan dengan Raspi), buka browser:

- **http://IP_RASPI:8000/docs**: halaman untuk mencoba semua fitur dengan klik
- **http://IP_RASPI:8000/status**: semua data monitoring
- **http://IP_RASPI:8000/video**: live preview kamera

## Daftar endpoint

| Endpoint | Fungsi |
|---|---|
| `GET /status` | Semua data (posisi, IMU, baterai, benih, rata-rata) |
| `WS /ws` | Data yang sama, real-time 5x per detik |
| `POST /battery` | Set baterai (**wajib setiap ganti baterai**) |
| `POST /seed/load` | Set jumlah benih yang dimuat |
| `POST /drop/config` | Atur thrust (%) dan durasi (detik) |
| `POST /drop` | Jalankan drop (mengurangi benih, dicatat di riwayat) |
| `POST /thruster/test` | **Tes thruster** (tidak mengurangi benih, tidak dicatat) |
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

Batas aman: durasi tes maksimal 10 detik, thrust 0-100%.
Kalau thruster tidak bereaksi, cek `servo_channel` di `config.json` dan pastikan `SERVOx_FUNCTION = 0` untuk channel itu.

## Pengaturan drop (`config.json`)

- `servo_channel`: nomor output AUX di Pixhawk yang dipakai mekanisme drop (default 9). Di Mission Planner, set `SERVOx_FUNCTION = 0` untuk channel itu supaya bisa dikontrol manual.
- `pwm_min` / `pwm_max`: rentang sinyal PWM. Thrust 0% = `pwm_min`, 100% = `pwm_max`.
- `seeds_per_drop`: jumlah benih yang berkurang setiap kali drop.

## Hal penting

1. **Lepas baling-baling dan uji mekanisme drop di darat dulu.**
2. **Panggil `POST /battery` setiap ganti baterai.** Itu yang me-reset hitungan mAh terpakai. Lakukan saat baterai penuh.
3. Hitungan baterai di sini berdasarkan arus dari Pixhawk. Kalau power module belum terkonfigurasi, nilainya kosong (`null`).
4. Kamera hanya bisa dibuka satu proses. Kalau error, pastikan tidak ada program lain yang memakai kamera.
5. Kalau Pixhawk belum terhubung, `POST /drop` akan ditolak.

## Troubleshooting

| Masalah | Solusi |
|---|---|
| Tidak muncul `Pixhawk terhubung!` | Cek MAVProxy sudah jalan, kabel TX/RX, dan baud rate |
| `voltage`/`current` kosong | Cek power module dan `BATT_MONITOR` di Pixhawk |
| Video tidak muncul | Cek kamera dengan `rpicam-hello`, atau pastikan `picamera2` terinstall |
| Tidak bisa dibuka dari laptop | Pastikan laptop dan Raspi satu WiFi, dan server jalan dengan `--host 0.0.0.0` |

## Yang belum ada (rencana berikutnya)

- Otomatis kembali (RTL) saat baterai rendah. Datanya sudah ada di `battery.low`, tinggal ditambah logikanya di `drone.py`.
- Dashboard web (peta, gauge, video jadi satu halaman)
