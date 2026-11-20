"""Pixhawk PALSU untuk tes tanpa hardware.

Mengirim pesan MAVLink asli (HEARTBEAT, GPS, ATTITUDE, 4 motor, dst.) lewat UDP ke backend,
persis seperti yang dikirim MAVProxy. Perintah servo dari backend (tombol drop / tes
thruster) ditampilkan di terminal ini.

Cara pakai (dua terminal, dua-duanya dari folder backend/):

    Terminal 1:  uvicorn app.main:app --port 8000
    Terminal 2:  python scripts/simulate_pixhawk.py

Lalu buka http://127.0.0.1:8000/docs
"""
import argparse
import math
import time

from pymavlink import mavutil

mav = mavutil.mavlink


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--target", default="udpout:127.0.0.1:14551",
                   help="harus cocok dengan MAVLINK_CONN di backend (udpin -> udpout)")
    p.add_argument("--lat", type=float, default=-6.8971983)    # kampus ITENAS Bandung
    p.add_argument("--lon", type=float, default=107.636371)
    p.add_argument("--armed", action="store_true",
                   help="status armed + 4 motor berputar (tanpa ini motor diam di PWM 1000)")
    p.add_argument("--no-power-module", action="store_true",
                   help="SYS_STATUS tanpa voltase/arus (seperti Pixhawk tanpa power module)")
    args = p.parse_args()

    link = mavutil.mavlink_connection(args.target, source_system=1, source_component=1)
    print(f"Simulator Pixhawk jalan -> {args.target}  (Ctrl+C untuk berhenti)")

    base_mode = mav.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED
    if args.armed:
        base_mode |= mav.MAV_MODE_FLAG_SAFETY_ARMED

    t0 = time.time()
    last_hb = 0.0
    test = None  # tes motor yang sedang berjalan (dari POST /thruster/test target=motor_N)
    while True:
        t = time.time() - t0

        # --- 1 Hz: heartbeat ---
        if time.time() - last_hb >= 1.0:
            link.mav.heartbeat_send(
                mav.MAV_TYPE_QUADROTOR, mav.MAV_AUTOPILOT_ARDUPILOTMEGA,
                base_mode, 4,  # 4 = GUIDED pada ArduCopter
                mav.MAV_STATE_ACTIVE,
            )
            last_hb = time.time()

        # --- drone berputar membentuk lingkaran kecil, 8 m/s ---
        ang = t * 0.2
        lat = args.lat + 0.0005 * math.sin(ang)
        lon = args.lon + 0.0005 * math.cos(ang)
        alt_m = 10 + 2 * math.sin(t * 0.5)

        link.mav.global_position_int_send(
            int(t * 1000) & 0xFFFFFFFF, int(lat * 1e7), int(lon * 1e7),
            int(alt_m * 1000), int(alt_m * 1000), 0, 0, 0, 0)
        link.mav.attitude_send(int(t * 1000) & 0xFFFFFFFF,
                               0.05 * math.sin(t), 0.08 * math.cos(t), ang % (2 * math.pi),
                               0, 0, 0)
        link.mav.vfr_hud_send(8.0, 8.0, int(math.degrees(ang) % 360), 50, alt_m, 0)
        link.mav.gps_raw_int_send(int(t * 1e6), 3, int(lat * 1e7), int(lon * 1e7),
                                  int(alt_m * 1000), 100, 100, 800, 0, 12)

        if args.no_power_module:
            volt_mv, cur_ca = 65535, -1
        else:
            volt_mv = int((22.2 - 0.002 * t) * 1000)   # 6S pelan-pelan turun
            cur_ca = int(25.0 * 100)                    # 25 A
        link.mav.sys_status_send(0, 0, 0, 500, volt_mv, cur_ca, -1,
                                 0, 0, 0, 0, 0, 0)

        # --- 4 motor/propeler (output 1-4). Disarm = diam, armed = putaran hover ---
        if args.armed:
            base = 1500 + 30 * math.sin(t * 0.5)
            # tiap motor sedikit beda supaya terlihat seperti drone sungguhan
            motors = [int(base + 25 * math.sin(t + k * math.pi / 2)) for k in range(4)]
        else:
            motors = [1000, 1000, 1000, 1000]

        # --- tes motor dari backend: putar motor yang dites sampai timeout ---
        if test is not None:
            step = int((time.time() - test["start"]) // test["timeout"]) if test["timeout"] else 99
            if step >= test["count"]:
                print(f"[{t:6.1f}s] <<< tes motor selesai (Pixhawk menghentikan sendiri)")
                test = None
            else:
                motors[test["first"] - 1 + step] = int(1000 + test["throttle"] * 10)

        link.mav.servo_output_raw_send(int(t * 1e6), 0, *motors, 0, 0, 0, 0)

        # --- baca perintah dari backend (servo) ---
        while True:
            m = link.recv_match(blocking=False)
            if m is None:
                break
            if m.get_type() == "COMMAND_LONG" and m.command == mav.MAV_CMD_DO_SET_SERVO:
                print(f"[{t:6.1f}s] >>> SERVO channel={int(m.param1)} pwm={int(m.param2)}")
            elif m.get_type() == "COMMAND_LONG" and m.command == mav.MAV_CMD_DO_MOTOR_TEST:
                first, thr, timeout = int(m.param1), m.param3, m.param4
                count = max(1, int(m.param5))
                if args.armed:  # Pixhawk asli menolak tes motor saat armed
                    print(f"[{t:6.1f}s] >>> MOTOR TEST motor={first} DITOLAK (drone armed)")
                elif timeout == 0:
                    test = None
                    print(f"[{t:6.1f}s] >>> MOTOR TEST STOP")
                else:
                    test = {"first": first, "throttle": thr, "timeout": timeout,
                            "count": count, "start": time.time()}
                    print(f"[{t:6.1f}s] >>> MOTOR TEST motor={first} jumlah={count} "
                          f"throttle={thr:g}% timeout={timeout:g}s")

        time.sleep(0.2)  # 5 Hz


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nBerhenti.")
