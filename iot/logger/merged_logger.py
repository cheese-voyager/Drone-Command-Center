"""merged_logger.py - Gabungkan nilai terbaru semua pesan ke satu CSV (kolom 'TIPE.field')."""

import csv
from datetime import datetime

from pymavlink import mavutil

import config


class MergedLogger:
    def __init__(self, path, csv_rate, warmup):
        self.path = path
        self.period = 1.0 / csv_rate
        self.warmup = warmup
        self.state = {}
        self.file = None
        self.writer = None
        self.next_merge = 0.0

    def update(self, msg, target_system):
        """Simpan nilai terbaru semua field dari pesan milik Pixhawk."""
        t = msg.get_type()
        if t in config.SKIP_IN_MERGED:
            return
        if msg.get_srcSystem() != target_system:
            return
        if t == "HEARTBEAT" and msg.type == mavutil.mavlink.MAV_TYPE_GCS:
            return

        for n in msg.get_fieldnames():
            v = getattr(msg, n, "")
            if isinstance(v, (bytes, bytearray)):
                continue
            if isinstance(v, (list, tuple)):
                for i, x in enumerate(v):
                    self.state[f"{t}.{n}[{i}]"] = x
            else:
                self.state[f"{t}.{n}"] = v

    def _open(self, now):
        columns = ["timestamp", "elapsed_s", "armed", "flight_mode"] + sorted(self.state)
        self.file = open(self.path, "w", newline="", encoding="utf-8")
        self.writer = csv.DictWriter(self.file, fieldnames=columns,
                                     restval="", extrasaction="ignore")
        self.writer.writeheader()
        self.next_merge = now
        print(f"\n[INFO] merged.csv: {len(columns)} kolom")

    def tick(self, master, now, start):
        """Panggil tiap putaran loop. Tulis satu baris jika sudah waktunya.

        Timestamp dan elapsed_s dihitung dari jadwal (self.next_merge),
        bukan dari wall-clock, sehingga hasilnya seragam per period detik.
        """
        if self.writer is None:
            if now - start < self.warmup or not self.state:
                return
            self._open(now)
            # Bulatkan waktu mulai ke kelipatan period supaya elapsed rapi
            elapsed_now = now - start
            self.next_merge = start + (int(elapsed_now / self.period) + 1) * self.period

        if now < self.next_merge:
            return

        # Hitung elapsed dari jadwal (bukan wall-clock) agar seragam
        scheduled_elapsed = round(self.next_merge - start, 3)

        row = dict(self.state)
        row["timestamp"] = datetime.fromtimestamp(self.next_merge).isoformat(timespec="milliseconds")
        row["elapsed_s"] = scheduled_elapsed
        try:
            row["armed"] = int(master.motors_armed())
            row["flight_mode"] = master.flightmode
        except Exception:
            pass
        self.writer.writerow(row)

        self.next_merge += self.period
        if self.next_merge < now:
            self.next_merge = now + self.period

    def flush(self):
        if self.file:
            self.file.flush()

    def close(self):
        if self.file:
            self.file.close()
