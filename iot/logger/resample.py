#!/usr/bin/env python3
"""resample.py - Resample merged.csv ke interval seragam (default 1 detik).

Pemakaian:
    python resample.py pixhawk_20261120_124113/merged.csv               # default 1s
    python resample.py pixhawk_20261120_124113/merged.csv --interval 0.5  # 0.5s
    python resample.py merged.csv -o merged_1s.csv                       # output custom

Cara kerja:
    1. Baca merged.csv asli
    2. Buat grid waktu seragam (0, 1, 2, 3, ... detik dari elapsed pertama)
    3. Untuk tiap titik grid, ambil baris terdekat (nearest-neighbor)
    4. Tulis ke file output
"""

import argparse
import csv
import os
import sys
from datetime import datetime, timedelta


def parse_args():
    ap = argparse.ArgumentParser(description="Resample merged.csv ke interval seragam")
    ap.add_argument("input", help="Path ke merged.csv")
    ap.add_argument("-o", "--output", default=None,
                    help="Path output (default: merged_resampled.csv di folder yang sama)")
    ap.add_argument("--interval", type=float, default=1.0,
                    help="Interval waktu dalam detik (default: 1.0)")
    ap.add_argument("--method", choices=["nearest", "ffill"], default="nearest",
                    help="Metode interpolasi: nearest (terdekat) atau ffill (forward-fill)")
    return ap.parse_args()


def load_csv(path):
    """Baca CSV, return (header, rows) di mana rows = list of dict."""
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        header = reader.fieldnames
        rows = list(reader)
    return header, rows


def resample(header, rows, interval, method="nearest"):
    """Resample ke grid waktu seragam."""
    if not rows:
        return header, []

    # Parse elapsed_s
    for r in rows:
        r["_elapsed"] = float(r["elapsed_s"])

    elapsed_vals = [r["_elapsed"] for r in rows]
    e_min = elapsed_vals[0]
    e_max = elapsed_vals[-1]

    # Buat grid seragam
    grid = []
    t = e_min
    # Bulatkan ke kelipatan interval terdekat di atas e_min
    t = int(t / interval) * interval
    if t < e_min:
        t += interval
    while t <= e_max:
        grid.append(round(t, 3))
        t = round(t + interval, 3)

    # Untuk tiap titik grid, cari baris terdekat
    resampled = []
    idx = 0
    for target in grid:
        # Cari baris terdekat
        if method == "nearest":
            best_idx = idx
            best_dist = abs(rows[idx]["_elapsed"] - target)
            while idx + 1 < len(rows):
                d = abs(rows[idx + 1]["_elapsed"] - target)
                if d < best_dist:
                    best_dist = d
                    best_idx = idx + 1
                    idx += 1
                else:
                    break
            row = dict(rows[best_idx])
        else:  # ffill
            while idx + 1 < len(rows) and rows[idx + 1]["_elapsed"] <= target:
                idx += 1
            row = dict(rows[idx])

        # Override elapsed_s dan timestamp agar seragam
        row["elapsed_s"] = target

        # Hitung timestamp baru dari timestamp pertama + offset
        try:
            first_ts = datetime.fromisoformat(rows[0]["timestamp"])
            first_elapsed = rows[0]["_elapsed"]
            new_ts = first_ts + timedelta(seconds=(target - first_elapsed))
            row["timestamp"] = new_ts.isoformat(timespec="milliseconds")
        except Exception:
            pass

        # Hapus field internal
        row.pop("_elapsed", None)
        resampled.append(row)

    # Bersihkan rows asli
    for r in rows:
        r.pop("_elapsed", None)

    return header, resampled


def main():
    args = parse_args()
    if not os.path.isfile(args.input):
        sys.exit(f"[ERROR] File tidak ditemukan: {args.input}")

    output = args.output
    if output is None:
        d = os.path.dirname(args.input) or "."
        output = os.path.join(d, "merged_resampled.csv")

    print(f"[INFO] Membaca: {args.input}")
    header, rows = load_csv(args.input)
    print(f"[INFO] {len(rows)} baris, interval asli: ~{(float(rows[-1]['elapsed_s']) - float(rows[0]['elapsed_s'])) / max(len(rows) - 1, 1):.3f}s")

    header, resampled = resample(header, rows, args.interval, args.method)
    print(f"[INFO] Resample ke {args.interval}s -> {len(resampled)} baris")

    with open(output, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=header, restval="", extrasaction="ignore")
        w.writeheader()
        w.writerows(resampled)

    print(f"[DONE] Output: {output}")

    # Tampilkan contoh timestamp
    print(f"\nContoh timestamp (5 baris pertama):")
    for r in resampled[:5]:
        print(f"  {r['timestamp']}  elapsed={r['elapsed_s']}s")
    if len(resampled) > 5:
        print("  ...")
        for r in resampled[-3:]:
            print(f"  {r['timestamp']}  elapsed={r['elapsed_s']}s")


if __name__ == "__main__":
    main()
