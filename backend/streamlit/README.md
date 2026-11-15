# Dashboard Streamlit (tes beta)

UI sederhana untuk mencoba semua fitur backend tanpa frontend: monitor real-time, setup baterai/benih,
drop, tes thruster & 4 motor, stop darurat, riwayat drop (peta + CSV), kamera, dan diagnostik koneksi.

Streamlit hanya memanggil API lewat HTTP, jadi **backend harus jalan dulu**.

```bash
# Terminal 1 (dari folder backend/)
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Terminal 2 (dari folder backend/)
pip install -r streamlit/requirements.txt
streamlit run streamlit/app.py
```

Buka http://localhost:8501. Alamat backend diubah di sidebar, atau lewat variabel `BACKEND_URL`:

```bash
BACKEND_URL=http://IP_RASPI:8000 streamlit run streamlit/app.py     # Linux/Mac
set BACKEND_URL=http://IP_RASPI:8000 && streamlit run streamlit/app.py   # Windows cmd
```

Tanpa Pixhawk: jalankan `python scripts/simulate_pixhawk.py` di terminal lain.

## Catatan
- Tombol **STOP DARURAT** di sidebar selalu terlihat di semua tab.
- Tes motor butuh centang "baling-baling sudah dilepas", hanya saat disarm, maksimal 30% (aturan backend).
- Tab Kamera dibuka langsung oleh browser, jadi alamat backend di sana harus bisa dijangkau dari perangkat
  yang membuka Streamlit. Kamera hanya bisa dipakai satu proses.
- Folder ini sengaja tanpa `__init__.py` dan file utamanya `app.py`, supaya tidak bentrok dengan
  paket `streamlit`.
