"""summary.py - Ringkasan tipe pesan yang diterima (console + summary.csv)."""

import csv
import os


def write_summary(outdir, counts, total_time, total):
    total_time = max(total_time, 1e-6)
    rows = sorted(counts.items(), key=lambda x: -x[1])

    with open(os.path.join(outdir, "summary.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["message_type", "count", "avg_hz"])
        for name, c in rows:
            w.writerow([name, c, round(c / total_time, 2)])

    print(f"\n\n[DONE] {total} pesan, {len(rows)} tipe, {total_time:.1f} detik")
    print(f"{'TIPE PESAN':32s} {'JUMLAH':>8s} {'Hz':>7s}")
    for name, c in rows:
        print(f"{name:32s} {c:8d} {c / total_time:7.2f}")
    print(f"\nHasil tersimpan di folder: {outdir}")
