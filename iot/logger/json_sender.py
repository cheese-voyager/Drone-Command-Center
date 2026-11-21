"""json_sender.py - Baca CSV hasil rekaman, filter field, kirim JSON via HTTP.

Pemakaian:
    python json_sender.py pixhawk_20261120_124113/merged_resampled.csv
    python json_sender.py merged_resampled.csv --host 192.168.1.100 --port 5000
    python json_sender.py merged_resampled.csv --interval 1.0 --gcs-lat -6.9 --gcs-lon 107.6

Kirim baris per baris (simulasi replay) atau semua sekaligus (--batch).
"""

import argparse
import csv
import json
import math
import sys
import time
import urllib.request
import urllib.error


# ─── Mapping data_need.txt → field MAVLink ──────────────────────────────────

FIELD_MAP = {
    # --- Battery ---
    "battery_percentage":    "BATTERY_STATUS.battery_remaining",   # 0-100 %
    "battery_ampere":        "BATTERY_STATUS.current_battery",     # centiAmpere → Ampere
    "battery_voltage":       "SYS_STATUS.voltage_battery",         # mV → Volt

    # --- Signal / Position ---
    "latitude":              "GLOBAL_POSITION_INT.lat",            # degE7
    "longitude":             "GLOBAL_POSITION_INT.lon",            # degE7
    "altitude_msl":          "GLOBAL_POSITION_INT.alt",            # mm → meter
    "altitude_relative":     "GLOBAL_POSITION_INT.relative_alt",   # mm → meter
    "heading":               "GLOBAL_POSITION_INT.hdg",            # cdeg → degree
    "gps_fix_type":          "GPS_RAW_INT.fix_type",
    "satellites_visible":    "GPS_RAW_INT.satellites_visible",
    "gps_hdop":              "GPS_RAW_INT.eph",                    # cm → meter
    "gps_vdop":              "GPS_RAW_INT.epv",                    # cm → meter

    # --- Speed ---
    "speed_ms":              "VFR_HUD.groundspeed",                # m/s
    "airspeed_ms":           "VFR_HUD.airspeed",                   # m/s
    "climb_rate":            "VFR_HUD.climb",                      # m/s
    "vx":                    "GLOBAL_POSITION_INT.vx",             # cm/s → m/s
    "vy":                    "GLOBAL_POSITION_INT.vy",             # cm/s → m/s
    "vz":                    "GLOBAL_POSITION_INT.vz",             # cm/s → m/s

    # --- Attitude / IMU ---
    "pitch_rad":             "ATTITUDE.pitch",
    "roll_rad":              "ATTITUDE.roll",
    "yaw_rad":               "ATTITUDE.yaw",
    "pitchspeed":            "ATTITUDE.pitchspeed",
    "rollspeed":             "ATTITUDE.rollspeed",
    "yawspeed":              "ATTITUDE.yawspeed",

    # --- System ---
    "armed":                 "armed",
    "flight_mode":           "flight_mode",
    "throttle":              "VFR_HUD.throttle",
    "system_load":           "SYS_STATUS.load",                    # permill → %

    # --- Vibration ---
    "vibration_x":           "VIBRATION.vibration_x",
    "vibration_y":           "VIBRATION.vibration_y",
    "vibration_z":           "VIBRATION.vibration_z",

    # --- RC Channels (untuk dropper servo) ---
    "rc_channel_1":          "RC_CHANNELS.chan1_raw",
    "rc_channel_2":          "RC_CHANNELS.chan2_raw",
    "rc_channel_3":          "RC_CHANNELS.chan3_raw",
    "rc_channel_4":          "RC_CHANNELS.chan4_raw",
    "rc_channel_5":          "RC_CHANNELS.chan5_raw",
    "rc_channel_6":          "RC_CHANNELS.chan6_raw",
    "rc_channel_7":          "RC_CHANNELS.chan7_raw",
    "rc_channel_8":          "RC_CHANNELS.chan8_raw",
    "rc_rssi":               "RC_CHANNELS.rssi",
}

# Unit conversion: (multiplier, offset)
CONVERSIONS = {
    "battery_ampere":    (0.01, 0),     # centiAmpere → Ampere
    "battery_voltage":   (0.001, 0),    # mV → Volt
    "latitude":          (1e-7, 0),     # degE7 → degrees
    "longitude":         (1e-7, 0),
    "altitude_msl":      (0.001, 0),    # mm → meter
    "altitude_relative": (0.001, 0),
    "heading":           (0.01, 0),     # cdeg → degree
    "gps_hdop":          (0.01, 0),     # cm → meter
    "gps_vdop":          (0.01, 0),
    "vx":                (0.01, 0),     # cm/s → m/s
    "vy":                (0.01, 0),
    "vz":                (0.01, 0),
    "system_load":       (0.1, 0),      # permill → %
}


def haversine_m(lat1, lon1, lat2, lon2):
    """Jarak antara dua titik GPS dalam meter (Haversine)."""
    R = 6_371_000
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def convert_row(csv_row, gcs_lat=None, gcs_lon=None,
                prev_data=None, cumulative=None):
    """Konversi satu baris CSV → dict JSON dengan field yang diminta."""
    data = {
        "timestamp": csv_row.get("timestamp", ""),
        "elapsed_s": float(csv_row.get("elapsed_s", 0)),
    }

    for key, csv_field in FIELD_MAP.items():
        raw = csv_row.get(csv_field, "")
        if raw == "":
            data[key] = None
            continue
        try:
            val = float(raw)
        except (ValueError, TypeError):
            data[key] = raw
            continue

        # Konversi unit
        if key in CONVERSIONS:
            mul, off = CONVERSIONS[key]
            val = val * mul + off

        # Bulatkan angka float
        if isinstance(val, float):
            val = round(val, 6)

        data[key] = val

    # --- Kalkulasi tambahan ---

    # Jarak dari GCS (signal proxy)
    if gcs_lat is not None and gcs_lon is not None:
        lat = data.get("latitude")
        lon = data.get("longitude")
        if lat and lon and lat != 0 and lon != 0:
            data["distance_from_gcs_m"] = round(
                haversine_m(gcs_lat, gcs_lon, lat, lon), 1)
        else:
            data["distance_from_gcs_m"] = None

    # Signal strength estimation dari RSSI
    rssi = data.get("rc_rssi")
    if rssi is not None and rssi != 0:
        data["signal_strength_pct"] = round(min(rssi / 254 * 100, 100), 1)
    else:
        data["signal_strength_pct"] = None

    # Speed statistics (kumulatif)
    speed = data.get("speed_ms")
    if cumulative is not None and speed is not None:
        cumulative["speeds"].append(speed)
        cumulative["peak_speed"] = max(cumulative.get("peak_speed", 0), speed)
        if speed > 0.1:  # drone sudah bergerak
            cumulative["moving_speeds"].append(speed)
        data["average_speed_ms"] = round(
            sum(cumulative["speeds"]) / len(cumulative["speeds"]), 3)
        data["peak_speed_ms"] = round(cumulative["peak_speed"], 3)
        if cumulative["moving_speeds"]:
            data["lowest_moving_speed_ms"] = round(
                min(cumulative["moving_speeds"]), 3)
        else:
            data["lowest_moving_speed_ms"] = None

    # Total distance covered (kumulatif)
    if cumulative is not None and prev_data is not None:
        lat_now = data.get("latitude")
        lon_now = data.get("longitude")
        lat_prev = prev_data.get("latitude")
        lon_prev = prev_data.get("longitude")
        if all(v and v != 0 for v in [lat_now, lon_now, lat_prev, lon_prev]):
            seg = haversine_m(lat_prev, lon_prev, lat_now, lon_now)
            cumulative["distance_covered_m"] += seg
        data["distance_covered_m"] = round(
            cumulative.get("distance_covered_m", 0), 1)

    # Battery prediction (simple linear)
    if cumulative is not None:
        batt = data.get("battery_percentage")
        elapsed = data.get("elapsed_s", 0)
        if batt is not None and elapsed > 0:
            if cumulative.get("first_batt") is None:
                cumulative["first_batt"] = batt
                cumulative["first_elapsed"] = elapsed
            batt_used = cumulative["first_batt"] - batt
            time_elapsed = elapsed - cumulative["first_elapsed"]
            if batt_used > 0 and time_elapsed > 10:
                rate_per_sec = batt_used / time_elapsed
                remaining_sec = batt / rate_per_sec
                data["battery_remaining_min"] = round(remaining_sec / 60, 1)
            else:
                data["battery_remaining_min"] = None

    return data


def load_csv(path):
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader)


def send_json(url, payload, timeout=5):
    """Kirim JSON via HTTP POST. Return (success, status_code_or_error)."""
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return True, resp.status
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code}"
    except Exception as e:
        return False, str(e)


def parse_args():
    ap = argparse.ArgumentParser(description="Kirim data CSV sebagai JSON via HTTP")
    ap.add_argument("input", help="Path ke merged_resampled.csv")
    ap.add_argument("--host", default="127.0.0.1", help="IP server penerima")
    ap.add_argument("--port", type=int, default=5000, help="Port server penerima")
    ap.add_argument("--endpoint", default="/api/telemetry",
                    help="Endpoint HTTP (default /api/telemetry)")
    ap.add_argument("--interval", type=float, default=1.0,
                    help="Interval pengiriman dalam detik (simulasi replay)")
    ap.add_argument("--batch", action="store_true",
                    help="Kirim semua data sekaligus (tidak per baris)")
    ap.add_argument("--gcs-lat", type=float, default=None,
                    help="Latitude posisi GCS (untuk hitung jarak)")
    ap.add_argument("--gcs-lon", type=float, default=None,
                    help="Longitude posisi GCS (untuk hitung jarak)")
    ap.add_argument("--dry-run", action="store_true",
                    help="Tampilkan JSON tanpa mengirim ke server")
    return ap.parse_args()


def main():
    args = parse_args()
    rows = load_csv(args.input)
    if not rows:
        sys.exit("[ERROR] CSV kosong.")

    url = f"http://{args.host}:{args.port}{args.endpoint}"
    print(f"[INFO] {len(rows)} baris dari {args.input}")
    print(f"[INFO] Target: {url}")

    cumulative = {
        "speeds": [],
        "moving_speeds": [],
        "peak_speed": 0,
        "distance_covered_m": 0,
        "first_batt": None,
        "first_elapsed": 0,
    }
    prev_data = None

    if args.batch:
        # Kirim semua sekaligus
        all_data = []
        for row in rows:
            d = convert_row(row, args.gcs_lat, args.gcs_lon, prev_data, cumulative)
            all_data.append(d)
            prev_data = d
        payload = {"type": "batch", "count": len(all_data), "data": all_data}

        if args.dry_run:
            print(json.dumps(payload, indent=2, ensure_ascii=False))
            return

        ok, status = send_json(url, payload, timeout=30)
        if ok:
            print(f"[OK] Batch {len(all_data)} baris terkirim (HTTP {status})")
        else:
            print(f"[ERROR] Gagal mengirim: {status}")
    else:
        # Kirim per baris (replay)
        for i, row in enumerate(rows):
            d = convert_row(row, args.gcs_lat, args.gcs_lon, prev_data, cumulative)
            payload = {"type": "telemetry", "index": i, "data": d}

            if args.dry_run:
                print(json.dumps(payload, indent=2, ensure_ascii=False))
                if i >= 2:
                    print(f"... ({len(rows) - 3} baris lainnya)")
                    break
                continue

            ok, status = send_json(url, payload)
            ts = d.get("timestamp", "?")
            if ok:
                print(f"\r[SEND] {i + 1}/{len(rows)} | {ts} | "
                      f"batt={d.get('battery_percentage')}% "
                      f"spd={d.get('speed_ms')}m/s "
                      f"alt={d.get('altitude_relative')}m",
                      end="", flush=True)
            else:
                print(f"\n[ERROR] baris {i}: {status}")

            prev_data = d
            time.sleep(args.interval)

        print(f"\n[DONE] {len(rows)} baris terkirim.")


if __name__ == "__main__":
    main()
