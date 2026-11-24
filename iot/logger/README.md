# Flight Telemetry Logger & Dataset Collector

Folder ini digunakan untuk merekam seluruh data dan telemetri penerbangan dari Pixhawk (ArduPilot / PX4) ke file CSV dan format terpadu untuk analisis dan dataset model.

---

## 🚀 Cara Paling Praktis: Menggunakan GUI (1-Klik)

Untuk kemudahan operasional di lapangan tanpa perlu membuka banyak terminal manual:

1. **Jalankan GUI**:
   - Cukup **klik 2x file `run_gui.bat`** di folder `iot/` (atau `start_gui.bat` di dalam `logger/`).
   - Atau lewat terminal:
     ```powershell
     cd iot
     uv run python logger/gui.py
     ```

2. **Fitur Antarmuka GUI**:
   * **Auto-Detect Port COM**: Langsung mengenali Radio Telemetry SiK / Pixhawk Anda secara otomatis.
   * **Mode Router + Mission Planner**: Sekali klik tombol **[▶ MULAI REKAM & ROUTER]**, GUI langsung mengaktifkan router MAVLink dan perekam CSV sekaligus.
   * **Petunjuk Mission Planner Langsung di Layar**: Cukup buka Mission Planner, pilih **UDP**, klik **Connect**, port `14550`.
   * **Dashboard Real-time**: Memantau durasi terbang, total pesan MAVLink yang tersimpan, tipe pesan, serta volume trafik data radio secara live.
   * **Tombol Buka Folder**: Tombol **[📂 Buka Folder Hasil CSV]** untuk langsung membuka Windows Explorer ke folder output data yang baru saja direkam.

---

## 🛠️ Penggunaan Alternatif via Terminal (CLI)

### 1. Dual-Koneksi (Router + Mission Planner via CLI)
1. Colok Radio Telemetry (SiK 3DR).
2. Jalankan Router:
   ```powershell
   cd iot
   uv run python logger/telemetry_router.py
   ```
3. Hubungkan Mission Planner via **UDP port 14550**.
4. Jalankan Logger:
   ```powershell
   cd iot
   uv run python logger/main.py --router
   ```

### 2. Langsung USB / Tanpa Mission Planner
```powershell
cd iot
uv run python logger/main.py
```

---

## Opsi Tambahan CLI

| Opsi | Penjelasan |
| :--- | :--- |
| `--router` | Koneksi langsung via router UDP (`127.0.0.1:14551`) |
| `--params` | Unduh seluruh parameter Pixhawk ke `by_message/PARAM_VALUE.csv` |
| `--csv-rate N` | Frekuensi baris per detik di `merged.csv` (default: 1.0 Hz) |
| `--duration N` | Durasi rekam otomatis dalam detik (default: 0 = sampai Ctrl+C) |
| `-o / --outdir` | Tentukan nama folder output khusus |
