"""connection.py - Deteksi jenis koneksi (USB / radio telemetry / jaringan) dan buka koneksi."""

import sys

from pymavlink import mavutil

import config


def classify_port(p):
    """Tentukan jenis port serial dengan if-else.

    Return: 'usb' (Pixhawk langsung), 'telemetry' (radio SiK), atau 'unknown'.
    """
    name = p.device.lower()
    text = f"{p.description} {p.manufacturer}".lower()

    if p.vid in config.PIXHAWK_VIDS or "ttyacm" in name or any(k in text for k in config.USB_KEYWORDS):
        return "usb"
    elif p.vid in config.RADIO_VIDS or "ttyusb" in name or any(k in text for k in config.RADIO_KEYWORDS):
        return "telemetry"
    else:
        return "unknown"


def find_serial_port():
    """Cari port serial Pixhawk / radio secara otomatis. Return (port, jenis)."""
    from serial.tools import list_ports

    ports = list(list_ports.comports())
    if not ports:
        sys.exit("[ERROR] Tidak ada port serial. Cek kabel USB / radio telemetry.")

    print("[INFO] Port serial ditemukan:")
    candidates = []
    for p in ports:
        kind = classify_port(p)
        print(f"   {p.device:16s} {kind:10s} {p.description}")
        if kind != "unknown":
            candidates.append((p.device, kind))

    if candidates:
        return candidates[0]
    else:
        print("[WARN] Tidak ada port yang dikenali, memakai port pertama (dianggap USB).")
        return ports[0].device, "usb"


def kind_of_port(port):
    """Jenis port yang ditulis manual (mis. COM5 atau /dev/ttyUSB0)."""
    from serial.tools import list_ports

    for p in list_ports.comports():
        if p.device == port:
            kind = classify_port(p)
            if kind == "unknown":
                return "usb"
            else:
                return kind
    return "usb"


def open_connection(conn, baud):
    """Buka koneksi MAVLink. Return (master, jenis, port, baud)."""
    if conn == "auto":
        port, kind = find_serial_port()
    elif conn.startswith(("udp", "tcp")):
        port, kind = conn, "network"
    else:
        port, kind = conn, kind_of_port(conn)

    if kind == "network":
        master = mavutil.mavlink_connection(port)
        return master, kind, port, None

    if baud is None:
        if kind == "telemetry":
            baud = config.TELEM_BAUD
        else:
            baud = config.USB_BAUD

    master = mavutil.mavlink_connection(port, baud=baud)
    return master, kind, port, baud
