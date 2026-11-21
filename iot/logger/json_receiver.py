"""json_receiver.py - Server HTTP yang menerima JSON telemetri dari json_sender.py.

Pemakaian (di komputer penerima):
    python json_receiver.py                     # listen 0.0.0.0:5000
    python json_receiver.py --port 8080         # port lain
    python json_receiver.py --save-dir data     # simpan ke folder 'data'

Server ini menerima POST JSON di /api/telemetry, menampilkan data live
di console, dan opsional menyimpan ke file JSON.
"""

import argparse
import json
import os
import sys
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler


class TelemetryHandler(BaseHTTPRequestHandler):
    """Handler HTTP untuk menerima data telemetri JSON."""

    def do_POST(self):
        if self.path != self.server.endpoint:
            self.send_error(404, "Not Found")
            return

        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            payload = json.loads(body)
        except json.JSONDecodeError as e:
            self.send_error(400, f"Invalid JSON: {e}")
            return

        # Proses data
        self._handle_telemetry(payload)

        # Response
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        resp = json.dumps({"status": "ok", "received": True}).encode("utf-8")
        self.wfile.write(resp)

    def do_GET(self):
        """GET /api/telemetry → return data terbaru."""
        if self.path == self.server.endpoint:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            data = self.server.latest_data or {"status": "no data yet"}
            self.wfile.write(json.dumps(data, indent=2).encode("utf-8"))
        elif self.path == "/api/history":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(self.server.history[-100:], indent=2).encode("utf-8"))
        elif self.path == "/":
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(STATUS_HTML.encode("utf-8"))
        else:
            self.send_error(404)

    def _handle_telemetry(self, payload):
        msg_type = payload.get("type", "unknown")

        if msg_type == "batch":
            data_list = payload.get("data", [])
            count = len(data_list)
            print(f"\n[BATCH] Menerima {count} baris data")
            for d in data_list:
                self.server.latest_data = d
                self.server.history.append(d)
            if data_list:
                self._print_summary(data_list[-1], f"batch({count})")
            # Simpan ke file
            if self.server.save_dir:
                self._save_batch(data_list)

        elif msg_type == "telemetry":
            data = payload.get("data", {})
            idx = payload.get("index", "?")
            self.server.latest_data = data
            self.server.history.append(data)
            self._print_summary(data, f"#{idx}")
            # Simpan ke file (append)
            if self.server.save_dir:
                self._save_single(data)

    def _print_summary(self, data, label):
        ts = data.get("timestamp", "?")
        batt = data.get("battery_percentage")
        spd = data.get("speed_ms")
        alt = data.get("altitude_relative")
        lat = data.get("latitude")
        lon = data.get("longitude")
        dist = data.get("distance_from_gcs_m")
        sig = data.get("signal_strength_pct")
        mode = data.get("flight_mode", "?")
        armed = data.get("armed", "?")

        line = (f"\r[{label}] {ts} | "
                f"mode={mode} armed={armed} | "
                f"batt={batt}% | "
                f"spd={spd}m/s alt={alt}m | "
                f"lat={lat} lon={lon} | "
                f"gcs_dist={dist}m sig={sig}%")
        print(line, end="", flush=True)

    def _save_batch(self, data_list):
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        path = os.path.join(self.server.save_dir, f"batch_{ts}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data_list, f, indent=2, ensure_ascii=False)
        print(f"\n[SAVE] {len(data_list)} baris → {path}")

    def _save_single(self, data):
        path = os.path.join(self.server.save_dir, "telemetry_live.jsonl")
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps(data, ensure_ascii=False) + "\n")

    def log_message(self, format, *args):
        """Suppress default log agar console bersih."""
        pass


STATUS_HTML = """<!DOCTYPE html>
<html><head><title>Telemetry Receiver</title>
<meta http-equiv="refresh" content="2">
<style>
body { font-family: monospace; background: #1a1a2e; color: #e0e0e0; padding: 20px; }
h1 { color: #0f0; }
.box { background: #16213e; padding: 15px; border-radius: 8px; margin: 10px 0; }
.label { color: #888; }
.val { color: #0ff; font-weight: bold; }
</style></head>
<body>
<h1>🛩 Telemetry Receiver — Active</h1>
<div class="box">
<p>Endpoint: <span class="val">POST /api/telemetry</span></p>
<p>Latest data: <span class="val">GET /api/telemetry</span></p>
<p>History (last 100): <span class="val">GET /api/history</span></p>
</div>
<p class="label">Auto-refresh tiap 2 detik. Buka /api/telemetry untuk lihat data terbaru.</p>
</body></html>"""


def parse_args():
    ap = argparse.ArgumentParser(description="Server penerima JSON telemetri")
    ap.add_argument("--host", default="0.0.0.0",
                    help="Bind address (default 0.0.0.0 = semua interface)")
    ap.add_argument("--port", type=int, default=5000, help="Port (default 5000)")
    ap.add_argument("--endpoint", default="/api/telemetry",
                    help="Endpoint HTTP (default /api/telemetry)")
    ap.add_argument("--save-dir", default=None,
                    help="Folder untuk simpan data (opsional)")
    return ap.parse_args()


def main():
    args = parse_args()

    if args.save_dir:
        os.makedirs(args.save_dir, exist_ok=True)
        print(f"[INFO] Data akan disimpan ke: {args.save_dir}")

    server = HTTPServer((args.host, args.port), TelemetryHandler)
    server.endpoint = args.endpoint
    server.save_dir = args.save_dir
    server.latest_data = None
    server.history = []

    print(f"[INFO] Server listening di http://{args.host}:{args.port}")
    print(f"[INFO] Endpoint: POST {args.endpoint}")
    print(f"[INFO] Status page: http://localhost:{args.port}/")
    print("[INFO] Ctrl+C untuk berhenti.\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print(f"\n\n[DONE] Total data diterima: {len(server.history)}")
        server.server_close()


if __name__ == "__main__":
    main()
