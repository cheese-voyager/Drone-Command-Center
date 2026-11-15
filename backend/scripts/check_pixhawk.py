import time

from pymavlink import mavutil

# 1. Inisialisasi koneksi telemetry
# Ganti 'COM3' dengan port Anda (Windows) atau '/dev/ttyUSB0' (Linux)
# Kecepatan baud standar telemetry biasanya 57600 (atau 115200 jika via USB)
connection = mavutil.mavlink_connection('COM3', baud=57600)

print("Menunggu heartbeat dari Pixhawk...")
connection.wait_heartbeat()
print(# Mengambil data telemetry (contoh: attitude / orientasi)
"Pixhawk terhubung! ID Sistem:", connection.target_system)

# 2. Loop untuk membaca data secara real-time
while True:
    try:
        # Membaca pesan khusus seperti ATTITUDE, GPS_RAW_INT, atau VFR_HUD
        msg = connection.recv_match(type='ATTITUDE', blocking=True, timeout=1.0)
        if msg:
            print(f"Roll: {msg.roll:.2f}, Pitch: {msg.pitch:.2f}, Yaw: {msg.yaw:.2f}")
    except KeyboardInterrupt:
        break
    time.sleep(0.1)
