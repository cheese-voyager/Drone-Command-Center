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
    ap.add_argument("--router", action="store_true",
                    help=f"Koneksi via telemetry router UDP (port {config.ROUTER_PORT_LOGGER})")
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


def run_logger(
    conn="auto",
    baud=None,
    router=False,
    stream_rate=None,
    csv_rate=config.DEFAULT_CSV_RATE,
    warmup=5.0,
    duration=0,
    params=False,
    all_intervals=False,
    outdir=None,
    stop_event=None,
    status_callback=None,
    log_callback=None,
):
    """Fungsi utama perekaman log MAVLink, dapat dipanggil dari CLI maupun GUI."""
    def log(msg):
        print(msg)
        if log_callback:
            try:
                log_callback(str(msg))
            except Exception:
                pass

    outdir = outdir or f"pixhawk_{datetime.now():%Y%m%d_%H%M%S}"
    os.makedirs(outdir, exist_ok=True)

    # 1. Koneksi (USB / radio telemetry / jaringan / router)
    conn_target = f"udpin:{config.ROUTER_HOST}:{config.ROUTER_PORT_LOGGER}" if router else conn
    master, kind, port, baud = open_connection(conn_target, baud)
    if kind == "network":
        log(f"[INFO] Koneksi jaringan: {port}")
    else:
        log(f"[INFO] {port} @ {baud} baud (jenis: {kind})")

    logger = None
    merged = None
    start = time.time()
    total = 0

    try:
        log("[INFO] Menunggu heartbeat (maks 15 detik) ...")
        if master.wait_heartbeat(timeout=15) is None:
            err_msg = "[ERROR] Tidak ada heartbeat. Cek port, baudrate, dan kabel/radio."
            log(err_msg)
            raise RuntimeError(err_msg)
        log(f"[OK] Terhubung: system {master.target_system}, component {master.target_component}")

        # 2. Frekuensi stream sesuai jenis koneksi
        if stream_rate is not None:
            effective_rate = max(1, stream_rate)
        elif router or kind == "telemetry":
            effective_rate = config.STREAM_RATE_TELEM
            log(f"[INFO] Radio telemetry (via router / radio): stream {effective_rate} Hz (bandwidth terbatas)")
        elif kind == "usb":
            effective_rate = config.STREAM_RATE_USB
        else:
            effective_rate = config.STREAM_RATE_NET

        try:
            master.setup_logfile(os.path.join(outdir, "flight.tlog"))
        except Exception as e:
            log(f"[WARN] Tidak bisa membuat tlog: {e}")

        request_data(master, effective_rate, all_intervals)
        if params:
            master.param_fetch_all()

        # 3. Logger
        logger = TypeLogger(os.path.join(outdir, "by_message"))
        merged = MergedLogger(os.path.join(outdir, "merged.csv"), csv_rate, warmup)

        total = 0
        bad_data = 0
        start = last_flush = time.time()
        log(f"[INFO] Merekam ke folder '{outdir}'. Tekan Stop atau Ctrl+C untuk berhenti.")

        # 4. Loop utama
        while True:
            if stop_event and stop_event.is_set():
                break
            now = time.time()
            if duration and now - start >= duration:
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
                if status_callback:
                    try:
                        status_callback({
                            "elapsed": elapsed,
                            "total": total,
                            "types": len(logger.counts),
                            "bad_data": bad_data,
                            "outdir": outdir,
                        })
                    except Exception:
                        pass

    except KeyboardInterrupt:
        pass
    finally:
        total_time = time.time() - start
        if logger:
            logger.close()
        if merged:
            merged.close()
        try:
            master.close()
        except Exception:
            pass
        if logger:
            write_summary(outdir, logger.counts, total_time, total)
            log(f"\n[INFO] Selesai. Total durasi: {total_time:.1f} detik | Total pesan: {total}")
        if status_callback:
            try:
                status_callback({
                    "elapsed": total_time,
                    "total": total,
                    "types": len(logger.counts) if logger else 0,
                    "bad_data": bad_data if 'bad_data' in locals() else 0,
                    "outdir": outdir,
                    "finished": True,
                })
            except Exception:
                pass


def main():
    args = parse_args()
    try:
        run_logger(
            conn=args.conn,
            baud=args.baud,
            router=args.router,
            stream_rate=args.stream_rate,
            csv_rate=args.csv_rate,
            warmup=args.warmup,
            duration=args.duration,
            params=args.params,
            all_intervals=args.all_intervals,
            outdir=args.outdir,
        )
    except RuntimeError as e:
        sys.exit(str(e))


if __name__ == "__main__":
    main()
