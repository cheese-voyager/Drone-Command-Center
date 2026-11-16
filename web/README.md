# Frontend Dashboard Web (Drone Command Center)

React + TypeScript + Vite dashboard untuk backend `drone penebar benih`.

## Fitur

- Monitor real-time: posisi, ketinggian, IMU, GPS, baterai, benih, 4 motor, video.
- Kontrol: drop benih, tes thruster/motor, stop darurat.
- Peta: posisi drone, jejak terbang, titik drop.
- Riwayat drop + unduh CSV.

Komunikasi memakai MQTT (WebSocket port 9001 via broker Mosquitto) + REST untuk data sekali ambil. Detail desain: `../docs/web-design.md`.

## Menjalankan

```bash
npm install
cp .env.example .env.local
# isi VITE_API_URL, VITE_MQTT_USER, VITE_MQTT_PASSWORD
npm run dev
```

Build produksi: `npm run build`.

## Perintah

```bash
npm run dev        # dev server
npm run build      # tsc + vite build
npm run typecheck  # tsc
npm run lint       # eslint
npm run test       # vitest
```

## Koneksi backend

Pastikan backend berjalan (`uvicorn app.main:app` di `backend/`) dan broker MQTT (mode laptop: `mosquitto -c iot/raspi/mosquitto/seeder-dev.conf`). Untuk tanpa drone: `python scripts/simulate_pixhawk.py`.
