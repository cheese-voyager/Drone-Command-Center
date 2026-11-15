"""Dashboard Streamlit untuk TES BETA backend Drone Penebar Benih.

Berbicara ke backend lewat HTTP (endpoint yang sama dengan /docs), jadi backend harus sudah jalan:

    # terminal 1 (dari folder backend/)
    uvicorn app.main:app --host 0.0.0.0 --port 8000

    # terminal 2 (dari folder backend/)
    pip install -r streamlit/requirements.txt
    streamlit run streamlit/app.py

Alamat backend bisa diubah di sidebar, atau lewat environment variable BACKEND_URL.
"""
import os
import time
from datetime import datetime

import pandas as pd
import requests
import streamlit.components.v1 as components

import streamlit as st

DEFAULT_BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")
HTTP_TIMEOUT_S = 5
MOTOR_TEST_MAX_PERCENT = 30  # sama dengan batas di backend
GPS_FIX_NAMES = {
    0: "Tidak ada GPS", 1: "Tidak ada fix", 2: "2D fix", 3: "3D fix",
    4: "DGPS", 5: "RTK float", 6: "RTK fixed",
}
TEST_TARGETS = {
    "Thruster penebar benih": "seeder",
    "Motor 1": "motor_1",
    "Motor 2": "motor_2",
    "Motor 3": "motor_3",
    "Motor 4": "motor_4",
    "Semua motor (berurutan 1-4)": "all_motors",
}

st.set_page_config(page_title="Drone Penebar Benih - Tes Beta", page_icon="🛰️", layout="wide")


# ---------------------------------------------------------------- akses API
def base_url() -> str:
    return st.session_state.get("base_url", DEFAULT_BACKEND_URL).strip().rstrip("/")


def api(method: str, path: str, **kwargs) -> tuple[object | None, str | None]:
    """Panggil backend. Return (data, None) kalau sukses, (None, pesan_error) kalau gagal."""
    try:
        r = requests.request(method, base_url() + path, timeout=HTTP_TIMEOUT_S, **kwargs)
    except requests.RequestException as exc:
        return None, f"Tidak bisa menghubungi backend di {base_url()} ({type(exc).__name__})"
    if r.ok:
        try:
            return r.json(), None
        except ValueError:
            return None, f"Backend membalas bukan JSON (HTTP {r.status_code})"
    try:
        body = r.json()
        detail = body.get("detail")
        if isinstance(detail, list):  # error validasi (422) bentuk standar FastAPI
            detail = "; ".join(f"{'.'.join(map(str, d.get('loc', [])[1:]))}: {d.get('msg')}" for d in detail)
        code = body.get("code")
        return None, f"HTTP {r.status_code}" + (f" [{code}]" if code else "") + f": {detail}"
    except ValueError:
        return None, f"HTTP {r.status_code}: {r.text[:200]}"


def show_result(data, err, ok_text: str) -> None:
    if err:
        st.error(err)
    else:
        st.success(ok_text)
        if data is not None:
            st.json(data, expanded=False)


def fmt(value, unit: str = "", digits: int = 1) -> str:
    if value is None:
        return "-"
    if isinstance(value, float):
        return f"{value:.{digits}f}{unit}"
    return f"{value}{unit}"


# ---------------------------------------------------------------- sidebar
with st.sidebar:
    st.title("🛰️ Tes Beta")
    st.text_input("Alamat backend", value=DEFAULT_BACKEND_URL, key="base_url",
                  help="Contoh: http://localhost:8000 atau http://IP_RASPI:8000")
    auto_refresh = st.toggle("Auto-refresh monitor", value=True)
    refresh_s = st.select_slider("Interval refresh (detik)", options=[0.5, 1, 2, 5], value=1)

    st.divider()
    if st.button("🛑 STOP DARURAT", type="primary", width="stretch",
                 help="POST /thruster/stop - hentikan thruster & tes motor"):
        data, err = api("POST", "/thruster/stop")
        if err:
            st.error(f"STOP GAGAL: {err}. Putuskan daya secara manual!")
        elif data and data.get("stopped"):
            st.success("Thruster dihentikan.")
        else:
            st.error("Perintah stop TIDAK berhasil terkirim ke Pixhawk. "
                     "Anggap thruster masih bisa menyala, putuskan daya secara manual!")
    st.caption("Tes dulu di darat. **Lepas baling-baling** saat tes motor.")


# ---------------------------------------------------------------- tab Monitor
@st.fragment(run_every=refresh_s if auto_refresh else None)
def monitor() -> None:
    t0 = time.perf_counter()
    s, err = api("GET", "/status")
    latency_ms = (time.perf_counter() - t0) * 1000
    if err:
        st.error(err)
        st.caption("Pastikan backend jalan: `uvicorn app.main:app --host 0.0.0.0 --port 8000`")
        return

    c1, c2 = st.columns([3, 1])
    if s["connected"]:
        c1.success("Pixhawk TERHUBUNG")
    else:
        c1.error("Pixhawk TIDAK terhubung. Cek `MAVLINK_CONN` di .env dan log backend "
                 "(peringatan `Belum ada HEARTBEAT`).")
    c2.caption(f"Respons backend: {latency_ms:.0f} ms · {datetime.now():%H:%M:%S}")

    a, b, c, d = st.columns(4)
    a.metric("Mode", s["mode"] or "-")
    b.metric("Armed", "ARMED" if s["armed"] else "disarm")
    c.metric("Altitude", fmt(s["alt"], " m"))
    d.metric("Kecepatan (rata-rata)", fmt(s["avg_speed"], " m/s"),
             delta=f"now {fmt(s['speed'], ' m/s')}", delta_color="off")
    if s["armed"]:
        st.warning("Drone dalam keadaan ARMED: tes motor akan ditolak.")

    left, right = st.columns(2)
    with left:
        st.subheader("Posisi & GPS")
        p1, p2 = st.columns(2)
        p1.metric("Latitude", fmt(s["lat"], digits=6))
        p2.metric("Longitude", fmt(s["lon"], digits=6))
        st.metric("Satelit", fmt(s["satellites"]),
                  delta=GPS_FIX_NAMES.get(s["gps_fix"], "-"), delta_color="off")
        if s["connected"] and s["lat"] is None:
            st.warning("Belum ada posisi. Biasanya GPS belum fix (perlu 3D fix, di luar ruangan). "
                       "Cek tab Diagnostik untuk melihat pesan apa saja yang masuk.")
        if s["lat"] is not None and s["lon"] is not None:
            st.map(pd.DataFrame({"lat": [s["lat"]], "lon": [s["lon"]]}), zoom=17, size=2, height=250)

        st.subheader("Orientasi (IMU)")
        q1, q2, q3 = st.columns(3)
        q1.metric("Pitch", fmt(s["pitch"], "°"))
        q2.metric("Roll", fmt(s["roll"], "°"))
        q3.metric("Yaw", fmt(s["yaw"], "°", 0))

    with right:
        bat = s["battery"]
        st.subheader("Baterai")
        v1, v2, v3 = st.columns(3)
        v1.metric("Tegangan", fmt(s["voltage"], " V", 2))
        v2.metric("Arus", fmt(s["current"], " A"))
        v3.metric("Sisa waktu", fmt(bat["estimated_minutes_left"], " mnt"))
        pct = max(0.0, min(100.0, bat["remaining_percent"]))
        st.progress(pct / 100, text=f"Sisa {pct:.0f}% · terpakai {bat['used_mah']:.0f} / "
                                    f"{bat['capacity_mah']} mAh")
        if bat["low"]:
            st.error("Baterai RENDAH, segera mendarat.")
        if s["voltage"] is None:
            st.caption("Tegangan/arus kosong: cek power module dan `BATT_MONITOR`.")

        st.subheader("Benih")
        seed = s["seed"]
        w1, w2, w3 = st.columns(3)
        w1.metric("Dimuat", seed["loaded"])
        w2.metric("Sudah di-drop", seed["dropped"])
        w3.metric("Sisa", seed["remaining"])

        st.subheader("Motor penggerak (output 1-4)")
        motors = s["motors"]
        if not motors:
            st.caption("Belum ada data SERVO_OUTPUT_RAW dari Pixhawk.")
        else:
            for m in motors:
                st.progress(max(0.0, min(1.0, m["percent"] / 100)),
                            text=f"Motor {m['id']}: {m['percent']:.0f}% (PWM {m['pwm']})")


# ---------------------------------------------------------------- tab Setup
def setup_tab() -> None:
    st.caption("Atur dulu sebelum terbang/tes. Wajib `Baterai` setiap ganti baterai.")
    col1, col2, col3 = st.columns(3)

    with col1, st.form("battery_form"):
        st.subheader("Baterai")
        cap = st.number_input("Kapasitas (mAh)", min_value=1, value=10000, step=500)
        cells = st.number_input("Jumlah cell (S)", min_value=1, max_value=14, value=6)
        safe = st.number_input("Batas sisa aman (%)", min_value=0, max_value=100, value=25)
        if st.form_submit_button("Simpan baterai (reset mAh terpakai)"):
            data, err = api("POST", "/battery", json={
                "capacity_mah": int(cap), "cells": int(cells), "min_safe_percent": int(safe)})
            show_result(data, err, "Baterai disimpan.")

    with col2, st.form("seed_form"):
        st.subheader("Benih")
        loaded = st.number_input("Jumlah benih dimuat", min_value=0, value=200, step=10)
        if st.form_submit_button("Muat benih (reset hitungan drop)"):
            data, err = api("POST", "/seed/load", json={"loaded": int(loaded)})
            show_result(data, err, "Benih dimuat.")

    with col3, st.form("drop_cfg_form"):
        st.subheader("Pengaturan drop")
        thrust = st.slider("Thrust (%)", 0, 100, 70)
        dur = st.slider("Durasi (detik)", 0.1, 10.0, 1.5, step=0.1)
        if st.form_submit_button("Simpan pengaturan drop"):
            data, err = api("POST", "/drop/config", json={
                "thrust_percent": float(thrust), "duration_s": float(dur)})
            show_result(data, err, "Pengaturan drop disimpan.")


# ---------------------------------------------------------------- tab Kontrol
def control_tab() -> None:
    left, right = st.columns(2)

    with left:
        st.subheader("Drop benih")
        st.caption("Memakai thrust & durasi dari tab Setup. Mengurangi benih dan dicatat di riwayat.")
        sure = st.checkbox("Area drop aman, siap menebar", key="drop_sure")
        if st.button("🌱 DROP SEKARANG", disabled=not sure, width="stretch"):
            data, err = api("POST", "/drop")
            show_result(data, err, "Drop dijalankan.")

    with right:
        st.subheader("Tes thruster / motor")
        label = st.selectbox(
            "Yang dites", list(TEST_TARGETS),
            help="ArduPilot hanya bisa memutar SATU motor per waktu lewat perintah tes motor, jadi "
                 "'Semua motor' berjalan berurutan 1-4 (sama seperti Mission Planner).")
        target = TEST_TARGETS[label]
        is_motor = target != "seeder"
        max_thrust = MOTOR_TEST_MAX_PERCENT if is_motor else 100
        thrust = st.slider("Thrust (%)", 0, max_thrust, min(20, max_thrust), key=f"thr_{target}",
                           help="Tes motor dibatasi 30% oleh backend." if is_motor else None)
        dur = st.slider("Durasi (detik)", 0.5, 10.0, 2.0, step=0.5, key=f"dur_{target}",
                        help="Untuk 'Semua motor' ini durasi tiap motor." if target == "all_motors" else None)
        if is_motor:
            st.warning("Tes motor hanya saat **disarm**. Lepas semua baling-baling saat tes di meja.")
            ok = st.checkbox("Baling-baling sudah dilepas", key=f"props_{target}")
        else:
            ok = True
        if st.button("▶️ Jalankan tes", disabled=not ok, width="stretch"):
            data, err = api("POST", "/thruster/test", json={
                "target": target, "thrust_percent": float(thrust), "duration_s": float(dur)})
            show_result(data, err, "Tes dikirim. Berhenti otomatis setelah durasi habis.")
            if is_motor and not err:
                st.info("API menjawab 200 walau Pixhawk menolak (safety switch, dll). "
                        "Cek bar Motor di tab Monitor dan log backend.")


# ---------------------------------------------------------------- tab Riwayat
def history_tab() -> None:
    st.button("🔄 Muat ulang riwayat")
    drops, err = api("GET", "/drops")
    if err:
        st.error(err)
        return
    if not drops:
        st.info("Belum ada drop.")
        return
    df = pd.DataFrame(drops)
    df.insert(0, "waktu", pd.to_datetime(df.pop("time"), unit="s", utc=True)
              .dt.tz_convert("Asia/Jakarta").dt.strftime("%Y-%m-%d %H:%M:%S"))
    st.metric("Total drop", len(df))
    st.dataframe(df, width="stretch", hide_index=True)
    pts = df.dropna(subset=["lat", "lon"])
    if pts.empty:
        st.caption("Tidak ada titik berkoordinat (GPS belum ada saat drop).")
    else:
        st.map(pts[["lat", "lon"]], zoom=17, size=1.5)
    st.download_button("Unduh CSV", df.to_csv(index=False).encode(), "riwayat_drop.csv", "text/csv")


# ---------------------------------------------------------------- tab Kamera
def camera_tab() -> None:
    st.caption("Stream MJPEG dibuka langsung oleh **browser**, jadi alamat di bawah harus bisa "
               "dijangkau dari perangkat yang membuka halaman ini. Kamera hanya bisa dipakai satu proses.")
    cam_url = st.text_input("Alamat backend (untuk browser)", value=base_url(), key="cam_url")
    if st.toggle("Tampilkan kamera", value=False):
        components.html(
            f'<img src="{cam_url.rstrip("/")}/video" style="width:100%;max-width:800px;border-radius:8px" '
            'onerror="this.replaceWith(document.createTextNode(\'Kamera tidak tersedia (cek /video di backend).\'))">',
            height=620,
        )


# ---------------------------------------------------------------- tab Diagnostik
def diagnostics_tab() -> None:
    st.markdown(f"Backend: `{base_url()}` · [Buka /docs]({base_url()}/docs)")
    if st.button("Cek koneksi sekarang"):
        t0 = time.perf_counter()
        s, err = api("GET", "/status")
        ms = (time.perf_counter() - t0) * 1000
        if err:
            st.error(err)
        else:
            st.success(f"Backend merespons ({ms:.0f} ms). Pixhawk connected = {s['connected']}")
            st.json(s, expanded=True)
    dbg, err = api("GET", "/debug/mavlink")
    if err:
        st.error(err)
    else:
        st.subheader("Pesan MAVLink yang diterima")
        st.caption(f"Sumber: `{dbg['connection']}` · link aktif: {dbg['has_link']}")
        if not dbg["messages"]:
            st.info("Belum ada pesan sama sekali. Backend belum menerima data dari Pixhawk.")
        else:
            df = pd.DataFrame(dbg["messages"]).rename(columns={
                "type": "Pesan", "count": "Jumlah", "age_s": "Umur terakhir (detik)",
                "avg_hz": "Rata-rata (Hz)"})
            st.dataframe(df, width="stretch", hide_index=True)
            have = {m["type"] for m in dbg["messages"]}
            need = {"GLOBAL_POSITION_INT": "posisi (lat/lon/alt)", "ATTITUDE": "pitch/roll/yaw",
                    "GPS_RAW_INT": "GPS fix & satelit", "SYS_STATUS": "tegangan & arus",
                    "VFR_HUD": "kecepatan", "SERVO_OUTPUT_RAW": "bar motor"}
            missing = [f"`{k}` ({v})" for k, v in need.items() if k not in have]
            if missing:
                st.warning("Belum masuk: " + ", ".join(missing) + ". Tunggu beberapa detik; kalau tetap "
                           "kosong, Pixhawk tidak mengirimnya (cek parameter SRx_* atau baud/bandwidth).")
            else:
                st.success("Semua pesan yang dibutuhkan sudah masuk.")
    st.markdown(
        "**Kalau `connected` = false:** server default membaca `udpin:127.0.0.1:14551` (dari MAVProxy). "
        "Pixhawk langsung ke komputer: isi `MAVLINK_CONN=COM3,57600` di `.env` lalu restart backend."
    )


tab_mon, tab_setup, tab_ctrl, tab_hist, tab_cam, tab_diag = st.tabs(
    ["📡 Monitor", "⚙️ Setup", "🎮 Kontrol & Tes", "🗺️ Riwayat", "📷 Kamera", "🔧 Diagnostik"]
)
with tab_mon:
    monitor()
with tab_setup:
    setup_tab()
with tab_ctrl:
    control_tab()
with tab_hist:
    history_tab()
with tab_cam:
    camera_tab()
with tab_diag:
    diagnostics_tab()
