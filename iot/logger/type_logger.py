"""type_logger.py - Tulis tiap tipe pesan MAVLink ke file CSV-nya sendiri."""

import csv
import os
from collections import defaultdict


class TypeLogger:
    def __init__(self, folder):
        os.makedirs(folder, exist_ok=True)
        self.folder = folder
        self.files = {}
        self.counts = defaultdict(int)

    def write(self, msg, host_iso, elapsed):
        t = msg.get_type()
        entry = self.files.get(t)
        if entry is None:
            fields = list(msg.get_fieldnames())
            f = open(os.path.join(self.folder, f"{t}.csv"), "w", newline="", encoding="utf-8")
            w = csv.writer(f)
            w.writerow(["host_time", "elapsed_s", "src_sys", "src_comp"] + fields)
            entry = (f, w, fields)
            self.files[t] = entry
        _, w, fields = entry
        w.writerow(
            [host_iso, elapsed, msg.get_srcSystem(), msg.get_srcComponent()]
            + [getattr(msg, n, "") for n in fields]
        )
        self.counts[t] += 1

    def flush(self):
        for f, _, _ in self.files.values():
            f.flush()

    def close(self):
        for f, _, _ in self.files.values():
            f.close()
