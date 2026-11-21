"""stream.py - Minta Pixhawk mengirim semua stream data."""

import time

from pymavlink import mavutil

mavlink = mavutil.mavlink


def request_data(master, stream_rate, all_intervals=False):
    ts, tc = master.target_system, master.target_component

    # ArduPilot: semua grup stream
    for name in ("ALL", "RAW_SENSORS", "EXTENDED_STATUS", "RC_CHANNELS",
                 "RAW_CONTROLLER", "POSITION", "EXTRA1", "EXTRA2", "EXTRA3"):
        stream_id = getattr(mavlink, f"MAV_DATA_STREAM_{name}")
        master.mav.request_data_stream_send(ts, tc, stream_id, stream_rate, 1)

    # PX4 / ArduPilot baru: set interval per message ID (opsional, lebih berat)
    if all_intervals:
        interval_us = int(1e6 / stream_rate)
        for msg_id in sorted(mavlink.mavlink_map.keys()):
            master.mav.command_long_send(
                ts, tc, mavlink.MAV_CMD_SET_MESSAGE_INTERVAL, 0,
                msg_id, interval_us, 0, 0, 0, 0, 0,
            )
            time.sleep(0.005)
