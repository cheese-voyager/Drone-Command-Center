#!/usr/bin/env python3
"""
main.py - Rekam SEMUA pesan MAVLink dari Pixhawk 2.4.8 ke CSV.

Struktur file:
    main.py            program utama (jalankan ini)
    config.py          konstanta & default
    connection.py      deteksi USB / radio telemetry / UDP (if-else) + buka koneksi
    stream.py          minta Pixhawk mengirim semua stream
    type_logger.py     CSV per tipe pesan  -> by_message/
    merged_logger.py   CSV gabungan        -> merged.csv
    summary.py         ringkasan           -> summary.csv

Instalasi:
    pip install -r requirements.txt

Contoh:
    python main.py                                    # auto-detect USB / radio
    python main.py --conn COM5                        # port manual
    python main.py --conn udpin:0.0.0.0:14550         # UDP
    python main.py --params                           # + unduh semua parameter

Tekan Ctrl+C untuk berhenti.
"""

import argparse
import os
import sys
import time
from datetime import datetime

import config
from connection import open_connection
from merged_logger import MergedLogger
from stream import request_data
from summary import write_summary
from type_logger import TypeLogger


def parse_args():
    ap = argparse.ArgumentParser(description="Rekam semua pesan MAVLink Pixhawk ke CSV")
    ap.add_argument("--conn", default="auto",
                    help="'auto', port serial (COM5, /dev/ttyACM0), atau udpin:0.0.0.0:14550")
    ap.add_argument("--baud", type=int, default=None,
                    help="Baudrate (default: USB 115200, radio telemetry 57600)")
    ap.add_argument("--stream-rate", type=int, default=None,
                    help="Frekuensi stream ke Pixhawk (Hz). Default: USB 10, radio 2")
    ap.add_argument("--csv-rate", type=float, default=config.DEFAULT_CSV_RATE,
                    help="Baris per detik di merged.csv (default 1 = per detik)")
    ap.add_argument("--warmup", type=float, default=5.0,
                    help="Detik awal untuk mendeteksi kolom merged.csv (default 5)")
    ap.add_argument("--duration", type=float, default=0,
                    help="Durasi rekam (detik). 0 = sampai Ctrl+C")
    ap.add_argument("--params", action="store_true",
                    help="Unduh semua parameter (masuk ke by_message/PARAM_VALUE.csv)")
    ap.add_argument("--all-intervals", action="store_true",
                    help="Minta semua message ID via SET_MESSAGE_INTERVAL (PX4 / firmware baru)")
    ap.add_argument("-o", "--outdir", default=None,
                    help="Folder output (default: pixhawk_YYYYmmdd_HHMMSS)")
    return ap.parse_args()


def main():
    args = parse_args()

    outdir = args.outdir or f"pixhawk_{datetime.now():%Y%m%d_%H%M%S}"
    os.makedirs(outdir, exist_ok=True)

    # 1. Koneksi (USB / radio telemetry / jaringan)
    master, kind, port, baud = open_connection(args.conn, args.baud)
    if kind == "network":
        print(f"[INFO] Koneksi jaringan: {port}")
    else:
        print(f"[INFO] {port} @ {baud} baud (jenis: {kind})")

    print("[INFO] Menunggu heartbeat (maks 15 detik) ...")
    if master.wait_heartbeat(timeout=15) is None:
        sys.exit("[ERROR] Tidak ada heartbeat. Cek port, baudrate, dan kabel/radio.")
    print(f"[OK] Terhubung: system {master.target_system}, component {master.target_component}")

    # 2. Frekuensi stream sesuai jenis koneksi
    if args.stream_rate is not None:
        stream_rate = max(1, args.stream_rate)
    elif kind == "telemetry":
        stream_rate = config.STREAM_RATE_TELEM
        print(f"[INFO] Radio telemetry: stream {stream_rate} Hz (bandwidth terbatas)")
    elif kind == "usb":
        stream_rate = config.STREAM_RATE_USB
    else:
        stream_rate = config.STREAM_RATE_NET

    try:
        master.setup_logfile(os.path.join(outdir, "flight.tlog"))
    except Exception as e:
        print(f"[WARN] Tidak bisa membuat tlog: {e}")

    request_data(master, stream_rate, args.all_intervals)
    if args.params:
        master.param_fetch_all()

    # 3. Logger
    logger = TypeLogger(os.path.join(outdir, "by_message"))
    merged = MergedLogger(os.path.join(outdir, "merged.csv"), args.csv_rate, args.warmup)

    total = 0
    bad_data = 0
    start = last_flush = time.time()
    print(f"[INFO] Merekam ke folder '{outdir}'. Ctrl+C untuk berhenti.")

    # 4. Loop utama
    try:
        while True:
            now = time.time()
            if args.duration and now - start >= args.duration:
                break

            msg = master.recv_match(blocking=True, timeout=0.2)
            now = time.time()
            elapsed = round(now - start, 3)

            if msg is not None:
                t = msg.get_type()
                if t == "BAD_DATA":
                    bad_data += 1
                elif not t.startswith("UNKNOWN"):
                    logger.write(msg, datetime.now().isoformat(timespec="milliseconds"), elapsed)
                    merged.update(msg, master.target_system)
                    total += 1

            merged.tick(master, now, start)

            if now - last_flush >= 1.0:
                logger.flush()
                merged.flush()
                last_flush = now
                print(f"\r[REC] {elapsed:7.1f}s | {total} pesan | "
                      f"{len(logger.counts)} tipe | bad: {bad_data}", end="", flush=True)

    except KeyboardInterrupt:
        pass
    finally:
        total_time = time.time() - start
        logger.close()
        merged.close()
        master.close()
        write_summary(outdir, logger.counts, total_time, total)


if __name__ == "__main__":
    main()
