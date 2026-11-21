"""config.py - Konstanta dan pengaturan default."""

# Baudrate default
USB_BAUD = 115200      # USB langsung ke Pixhawk (baud sebenarnya diabaikan)
TELEM_BAUD = 57600     # Radio telemetry SiK/3DR

# Frekuensi stream default (Hz) sesuai jenis koneksi
STREAM_RATE_USB = 4    # cukup untuk csv-rate 1 Hz (Nyquist)
STREAM_RATE_TELEM = 2  # bandwidth radio kecil, jangan tinggi-tinggi
STREAM_RATE_NET = 4    # UDP / TCP

# Default csv-rate (baris/detik di merged.csv)
DEFAULT_CSV_RATE = 1.0  # 1 Hz = 1 baris per detik (timestamp seragam)

# Ciri-ciri port (dipakai di connection.py)
PIXHAWK_VIDS = (0x26AC, 0x1209, 0x0483)   # 3D Robotics/PX4, ArduPilot, STMicroelectronics
RADIO_VIDS = (0x0403, 0x10C4)             # FTDI, Silicon Labs CP210x (umum di radio SiK)
USB_KEYWORDS = ("pixhawk", "px4", "ardupilot", "fmu", "cube")
RADIO_KEYWORDS = ("sik", "radio", "ftdi", "ft232", "cp210")

# Pesan yang tidak dimasukkan ke merged.csv (tetap lengkap di by_message/)
SKIP_IN_MERGED = {
    "PARAM_VALUE", "STATUSTEXT", "LOG_ENTRY", "LOG_DATA", "ENCAPSULATED_DATA",
    "FILE_TRANSFER_PROTOCOL", "MISSION_ITEM", "MISSION_ITEM_INT", "MISSION_COUNT",
    "MISSION_CURRENT", "MISSION_ACK", "COMMAND_ACK", "STATUSTEXT_LONG",
    "AUTOPILOT_VERSION", "PROTOCOL_VERSION", "TIMESYNC",
}
