#!/usr/bin/env python3
"""
telemetry_router.py - MAVLink Telemetry Splitter / Router (Serial <-> UDP).

Membagi satu port serial radio telemetry (misal COM6) ke beberapa klien UDP:
  - Mission Planner  -> UDP 127.0.0.1:14550 (default port GCS)
  - Python Logger    -> UDP 127.0.0.1:14551 (default port logger)

Jalankan dengan:
  uv run python telemetry_router.py
  uv run python telemetry_router.py --port COM6 --baud 57600
"""

import argparse
import os
import socket
import sys
import threading
import time

# Pastikan modul logger lokal dapat diimpor
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import serial
import config
from connection import find_serial_port


def parse_args():
    ap = argparse.ArgumentParser(description="MAVLink Telemetry Serial <-> UDP Splitter")
    ap.add_argument("--port", default="auto",
                    help="Port serial radio telemetry (contoh: COM6) atau 'auto' (default: auto)")
    ap.add_argument("--baud", type=int, default=config.TELEM_BAUD,
                    help=f"Baudrate radio telemetry (default: {config.TELEM_BAUD})")
    ap.add_argument("--mp-port", type=int, default=config.ROUTER_PORT_MP,
                    help=f"Port UDP untuk Mission Planner (default: {config.ROUTER_PORT_MP})")
    ap.add_argument("--logger-port", type=int, default=config.ROUTER_PORT_LOGGER,
                    help=f"Port UDP untuk Logger (default: {config.ROUTER_PORT_LOGGER})")
    ap.add_argument("--bind-port", type=int, default=config.ROUTER_PORT_IN,
                    help=f"Port bind UDP lokal router (default: {config.ROUTER_PORT_IN})")
    return ap.parse_args()


class TelemetryRouter:
    def __init__(self, port, baud, mp_port, logger_port, bind_port):
        self.port = port
        self.baud = baud
        self.bind_port = bind_port
        self.running = False

        # Endpoint tujuan default
        self.destinations = {
            (config.ROUTER_HOST, mp_port),
            (config.ROUTER_HOST, logger_port),
        }

        # Statistik
        self.bytes_serial_to_udp = 0
        self.bytes_udp_to_serial = 0
        self.pkts_serial_to_udp = 0
        self.pkts_udp_to_serial = 0

        # Inisialisasi UDP socket (bind ke localhost 127.0.0.1 agar bebas permission error)
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        # Fix Windows WSAECONNRESET (10054) ketika port tujuan belum terbuka
        if hasattr(socket, "SIO_UDP_CONNRESET"):
            try:
                self.sock.ioctl(socket.SIO_UDP_CONNRESET, False)
            except Exception:
                pass
        self.sock.bind((config.ROUTER_HOST, self.bind_port or 0))
        self.actual_port = self.sock.getsockname()[1]
        self.sock.settimeout(0.2)

        # Inisialisasi Serial
        print(f"[INFO] Membuka port serial {self.port} @ {self.baud} baud ...")
        self.ser = serial.Serial(
            port=self.port,
            baudrate=self.baud,
            timeout=0.1,
            write_timeout=0.5
        )
        print(f"[OK] Serial {self.port} terhubung.")

    def serial_to_udp_loop(self):
        """Membaca data dari Pixhawk/Radio dan meneruskannya ke semua client UDP."""
        while self.running:
            try:
                waiting = self.ser.in_waiting
                data = self.ser.read(waiting if waiting > 0 else 1)
                if data:
                    self.bytes_serial_to_udp += len(data)
                    self.pkts_serial_to_udp += 1
                    for dest in list(self.destinations):
                        try:
                            self.sock.sendto(data, dest)
                        except Exception:
                            pass
            except serial.SerialException as e:
                print(f"\n[ERROR] Koneksi serial terputus: {e}")
                self.running = False
                break
            except Exception:
                time.sleep(0.001)

    def udp_to_serial_loop(self):
        """Menerima perintah dari Mission Planner / Logger dan meneruskannya ke Serial."""
        while self.running:
            try:
                data, addr = self.sock.recvfrom(4096)
                if data:
                    # Daftarkan client jika ada port dinamis yang mengirim balik
                    if addr not in self.destinations:
                        self.destinations.add(addr)
                    self.ser.write(data)
                    self.bytes_udp_to_serial += len(data)
                    self.pkts_udp_to_serial += 1
            except socket.timeout:
                continue
            except Exception:
                continue

    def start_background(self):
        """Menjalankan thread router di background (cocok untuk GUI)."""
        self.running = True
        self.start_time = time.time()
        self.t_s2u = threading.Thread(target=self.serial_to_udp_loop, daemon=True)
        self.t_u2s = threading.Thread(target=self.udp_to_serial_loop, daemon=True)
        self.t_s2u.start()
        self.t_u2s.start()

    def get_stats(self):
        """Mendapatkan metrik trafik real-time."""
        elapsed = time.time() - getattr(self, "start_time", time.time())
        return {
            "elapsed": elapsed,
            "bytes_down": self.bytes_serial_to_udp,
            "pkts_down": self.pkts_serial_to_udp,
            "bytes_up": self.bytes_udp_to_serial,
            "pkts_up": self.pkts_udp_to_serial,
        }

    def start(self):
        self.start_background()

        print("=" * 60)
        print("  MAVLink Telemetry Router AKTIF")
        print("=" * 60)
        print(f"  * Sumber Serial   : {self.port} @ {self.baud} baud")
        print(f"  * Mission Planner : UDP 127.0.0.1:{config.ROUTER_PORT_MP}")
        print(f"  * Python Logger   : UDP 127.0.0.1:{config.ROUTER_PORT_LOGGER}")
        print("  Tekan Ctrl+C untuk berhenti.")
        print("-" * 60)

        start_time = time.time()
        try:
            while self.running:
                time.sleep(1.0)
                elapsed = time.time() - start_time
                kb_down = self.bytes_serial_to_udp / 1024.0
                kb_up = self.bytes_udp_to_serial / 1024.0
                print(
                    f"\r[ROUTER] {elapsed:6.1f}s | "
                    f"Drone -> GCS/Log: {kb_down:7.1f} KB ({self.pkts_serial_to_udp} pkts) | "
                    f"GCS -> Drone: {kb_up:6.1f} KB",
                    end="",
                    flush=True,
                )
        except KeyboardInterrupt:
            print("\n[INFO] Menghentikan router...")
        finally:
            self.stop()

    def stop(self):
        self.running = False
        try:
            self.ser.close()
        except Exception:
            pass
        try:
            self.sock.close()
        except Exception:
            pass
        print("[OK] Router dihentikan dengan aman.")


def main():
    args = parse_args()
    port = args.port

    if port == "auto":
        detected_port, kind = find_serial_port()
        port = detected_port
        print(f"[INFO] Auto-detect: Menggunakan port {port} ({kind})")

    router = TelemetryRouter(
        port=port,
        baud=args.baud,
        mp_port=args.mp_port,
        logger_port=args.logger_port,
        bind_port=args.bind_port,
    )
    router.start()


if __name__ == "__main__":
    main()
