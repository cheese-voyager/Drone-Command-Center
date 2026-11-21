"""Konstanta yang dipakai di banyak tempat."""

# ---------- Batas keamanan thruster / drop ----------
THRUST_MIN_PERCENT = 0.0
THRUST_MAX_PERCENT = 100.0
MAX_DURATION_S = 10.0  # batas aman durasi tes thruster maupun drop

# Nilai awal tes thruster: mulai dari kecil!
DEFAULT_TEST_THRUST_PERCENT = 20.0
DEFAULT_TEST_DURATION_S = 2.0

# Percobaan mematikan servo kalau perintah "off" gagal terkirim
SERVO_OFF_RETRIES = 3
SERVO_OFF_RETRY_DELAY_S = 0.2

# Tes 4 motor penggerak (propeler): lebih ketat daripada thruster penebar benih
MOTOR_TEST_MAX_PERCENT = 30.0

# ---------- Baterai ----------
ROLLING_WINDOW = 50  # jumlah sampel terakhir untuk rata-rata arus & kecepatan
AMP_SECONDS_PER_MAH = 3.6  # 1 mAh = 3.6 A*detik
CURRENT_MIN_FOR_ESTIMATE_A = 0.5  # di bawah ini estimasi waktu terbang tidak dihitung

# ---------- MAVLink ----------
MAVLINK_STREAM_RATE_HZ = 5
MAVLINK_RECV_TIMEOUT_S = 3.0
MAVLINK_RECONNECT_DELAY_S = 2.0
SYS_STATUS_VOLTAGE_UNKNOWN = 65535  # mV, artinya "tidak diketahui"
SYS_STATUS_CURRENT_UNKNOWN = -1  # cA, artinya "tidak diketahui"

# ---------- Motor penggerak (4 propeler) ----------
MOTOR_COUNT = 4  # quadcopter: output servo/motor 1-4 di Pixhawk
MOTOR_PWM_MIN = 1000  # motor diam
MOTOR_PWM_MAX = 2000  # putaran penuh

# ---------- Kamera ----------
MJPEG_BOUNDARY = "frame"
MJPEG_MEDIA_TYPE = f"multipart/x-mixed-replace; boundary={MJPEG_BOUNDARY}"

# ---------- MQTT ----------
MQTT_MAX_PAYLOAD_BYTES = 4096  # perintah yang lebih besar dari ini ditolak
MQTT_RECONNECT_MIN_S = 1  # jeda awal sebelum mencoba tersambung lagi ke broker
MQTT_RECONNECT_MAX_S = 30
MQTT_STOP_TIMEOUT_S = 2.0  # batas waktu mengirim "offline" saat backend dimatikan
MQTT_COMMAND_QUEUE_SIZE = 50
MQTT_PRIORITY_COMMANDS = frozenset({"thruster-stop"})  # dijalankan langsung, tidak antre

# ---------- Riwayat drop ----------
MAX_DROP_HISTORY = 1000
MAV_STATUS_MESSAGE_HISTORY = 20

# ---------- Isi awal config.json ----------
DEFAULT_CONFIG: dict = {
    "battery": {
        "capacity_mah": 10000,
        "cells": 6,
        "min_safe_percent": 25,
    },
    "drop": {
        "servo_channel": 9,
        "thrust_percent": 70,
        "duration_s": 1.5,
        "seeds_per_drop": 1,
        "pwm_min": 1000,
        "pwm_max": 2000,
    },
    "seed": {
        "loaded": 0,
        "dropped": 0,
    },
}
