#!/usr/bin/env python3
"""
gui.py - Antarmuka Grafis (GUI) Sederhana untuk Telemetry Router & Data Logger Pixhawk.

Jalankan dengan:
  uv run python logger/gui.py
"""

import os
import sys
import threading
import time
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
from datetime import datetime

# Pastikan modul lokal terbaca
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import serial.tools.list_ports
import config
from connection import classify_port
from telemetry_router import TelemetryRouter
from main import run_logger


class TelemetryLoggerGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Drone Command Center - Flight Logger & Telemetry Router")
        self.root.geometry("780x680")
        self.root.minsize(700, 600)

        # Style & Thema
        self.style = ttk.Style()
        try:
            self.style.theme_use("clam")
        except Exception:
            pass

        # State aplikasi
        self.is_running = False
        self.router_instance = None
        self.stop_event = threading.Event()
        self.logger_thread = None
        self.current_outdir = None

        self._build_ui()
        self.refresh_ports()

        # Handle window close
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

    def _build_ui(self):
        # Frame Kontainer Utama
        main_frame = ttk.Frame(self.root, padding="15")
        main_frame.pack(fill=tk.BOTH, expand=True)

        # 1. Header
        header_frame = ttk.Frame(main_frame)
        header_frame.pack(fill=tk.X, pady=(0, 10))

        title_label = ttk.Label(
            header_frame,
            text="🚁 Pixhawk Telemetry & Data Logger",
            font=("Segoe UI", 16, "bold")
        )
        title_label.pack(anchor=tk.W)

        subtitle_label = ttk.Label(
            header_frame,
            text="Merekam data penerbangan ke CSV dan membagi koneksi MAVLink ke Mission Planner secara simultan.",
            font=("Segoe UI", 9)
        )
        subtitle_label.pack(anchor=tk.W)

        # 2. Pengaturan Koneksi (Card)
        conn_group = ttk.LabelFrame(main_frame, text=" 1. Pengaturan Koneksi & Perangkat ", padding="10")
        conn_group.pack(fill=tk.X, pady=(0, 10))

        # Baris Port & Baud
        port_row = ttk.Frame(conn_group)
        port_row.pack(fill=tk.X, pady=2)

        ttk.Label(port_row, text="Port Serial:", width=12).pack(side=tk.LEFT)
        self.port_combobox = ttk.Combobox(port_row, state="readonly", width=42)
        self.port_combobox.pack(side=tk.LEFT, padx=(0, 8))

        btn_refresh = ttk.Button(port_row, text="🔄 Refresh Port", command=self.refresh_ports)
        btn_refresh.pack(side=tk.LEFT, padx=(0, 15))

        ttk.Label(port_row, text="Baudrate:", width=10).pack(side=tk.LEFT)
        self.baud_var = tk.StringVar(value=str(config.TELEM_BAUD))
        self.baud_combobox = ttk.Combobox(
            port_row,
            textvariable=self.baud_var,
            values=["57600", "115200", "921600", "38400", "19200"],
            width=10,
            state="readonly"
        )
        self.baud_combobox.pack(side=tk.LEFT)

        # Mode Operasi
        mode_row = ttk.Frame(conn_group)
        mode_row.pack(fill=tk.X, pady=(8, 2))

        ttk.Label(mode_row, text="Mode Koneksi:", width=12).pack(side=tk.LEFT)
        self.mode_var = tk.StringVar(value="router")

        rb_router = ttk.Radiobutton(
            mode_row,
            text="Router + Mission Planner (Membagi COM6 ke MP dan Logger via UDP)",
            variable=self.mode_var,
            value="router",
            command=self._on_mode_change
        )
        rb_router.pack(side=tk.LEFT, padx=(0, 15))

        rb_direct = ttk.Radiobutton(
            mode_row,
            text="Langsung / USB (Tanpa Mission Planner)",
            variable=self.mode_var,
            value="direct",
            command=self._on_mode_change
        )
        rb_direct.pack(side=tk.LEFT)

        # Petunjuk Mission Planner
        self.mp_hint_frame = ttk.Frame(conn_group)
        self.mp_hint_frame.pack(fill=tk.X, pady=(8, 0))
        self.mp_hint_label = ttk.Label(
            self.mp_hint_frame,
            text="👉 Di Mission Planner: Pilih koneksi UDP di pojok kanan atas, klik Connect, dan masukkan Port 14550.",
            foreground="#0066cc",
            font=("Segoe UI", 9, "italic")
        )
        self.mp_hint_label.pack(anchor=tk.W)

        # 3. Pengaturan Logger (Card)
        log_group = ttk.LabelFrame(main_frame, text=" 2. Pengaturan Perekaman ", padding="10")
        log_group.pack(fill=tk.X, pady=(0, 10))

        log_opts_row = ttk.Frame(log_group)
        log_opts_row.pack(fill=tk.X)

        ttk.Label(log_opts_row, text="CSV Rate (Hz):", width=14).pack(side=tk.LEFT)
        self.csv_rate_var = tk.StringVar(value="1.0")
        self.csv_rate_cb = ttk.Combobox(
            log_opts_row,
            textvariable=self.csv_rate_var,
            values=["0.5", "1.0", "2.0", "4.0"],
            width=6,
            state="readonly"
        )
        self.csv_rate_cb.pack(side=tk.LEFT, padx=(0, 20))

        self.params_var = tk.BooleanVar(value=False)
        cb_params = ttk.Checkbutton(
            log_opts_row,
            text="Unduh Semua Parameter saat terhubung (--params)",
            variable=self.params_var
        )
        cb_params.pack(side=tk.LEFT)

        # 4. Status Dashboard Tiles
        dash_frame = ttk.Frame(main_frame)
        dash_frame.pack(fill=tk.X, pady=(0, 10))

        self.tile_status = self._create_tile(dash_frame, "Status", "SIAP", "#4a5568")
        self.tile_time = self._create_tile(dash_frame, "Durasi Rekam", "00:00:00", "#2b6cb0")
        self.tile_msgs = self._create_tile(dash_frame, "Total Pesan", "0", "#2c7a7b")
        self.tile_traffic = self._create_tile(dash_frame, "Trafik Router", "0 KB", "#744210")

        # 5. Tombol Aksi
        btn_frame = ttk.Frame(main_frame)
        btn_frame.pack(fill=tk.X, pady=(0, 10))

        self.btn_start = tk.Button(
            btn_frame,
            text="▶ MULAI REKAM & ROUTER",
            bg="#2e7d32",
            fg="white",
            font=("Segoe UI", 11, "bold"),
            relief=tk.FLAT,
            padx=18,
            pady=8,
            command=self.start_operation
        )
        self.btn_start.pack(side=tk.LEFT, padx=(0, 10))

        self.btn_stop = tk.Button(
            btn_frame,
            text="⏹ BERHENTI",
            bg="#c62828",
            fg="white",
            font=("Segoe UI", 11, "bold"),
            relief=tk.FLAT,
            padx=18,
            pady=8,
            state=tk.DISABLED,
            command=self.stop_operation
        )
        self.btn_stop.pack(side=tk.LEFT, padx=(0, 10))

        self.btn_open_folder = ttk.Button(
            btn_frame,
            text="📂 Buka Folder Hasil CSV",
            command=self.open_output_folder
        )
        self.btn_open_folder.pack(side=tk.RIGHT, pady=4)

        # 6. Terminal Log View
        log_group_box = ttk.LabelFrame(main_frame, text=" Log Aktivitas & Monitor ", padding="5")
        log_group_box.pack(fill=tk.BOTH, expand=True)

        self.log_text = scrolledtext.ScrolledText(
            log_group_box,
            wrap=tk.WORD,
            height=10,
            bg="#1e1e1e",
            fg="#d4d4d4",
            insertbackground="white",
            font=("Consolas", 9)
        )
        self.log_text.pack(fill=tk.BOTH, expand=True)

    def _create_tile(self, parent, title, initial_val, color):
        frame = tk.Frame(parent, bg="#f7fafc", bd=1, relief=tk.SOLID, padx=10, pady=6)
        frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=3)

        lbl_title = tk.Label(frame, text=title, font=("Segoe UI", 8), bg="#f7fafc", fg="#718096")
        lbl_title.pack(anchor=tk.W)

        lbl_val = tk.Label(frame, text=initial_val, font=("Segoe UI", 12, "bold"), bg="#f7fafc", fg=color)
        lbl_val.pack(anchor=tk.W)

        return lbl_val

    def _on_mode_change(self):
        if self.mode_var.get() == "router":
            self.mp_hint_frame.pack(fill=tk.X, pady=(8, 0))
            self.btn_start.config(text="▶ MULAI REKAM & ROUTER")
        else:
            self.mp_hint_frame.pack_forget()
            self.btn_start.config(text="▶ MULAI REKAM (LANGSUNG)")

    def log(self, message):
        """Append log message to the log box safely from any thread."""
        def _append():
            ts = datetime.now().strftime("%H:%M:%S")
            self.log_text.insert(tk.END, f"[{ts}] {message}\n")
            self.log_text.see(tk.END)
        self.root.after(0, _append)

    def refresh_ports(self):
        """Scan and populate COM ports."""
        ports = list(serial.tools.list_ports.comports())
        port_strings = []
        selected_index = 0

        for idx, p in enumerate(ports):
            kind = classify_port(p)
            tag = " [Pixhawk/Radio]" if kind != "unknown" else ""
            desc = f"{p.device}: {p.description}{tag}"
            port_strings.append(desc)
            if kind != "unknown" and selected_index == 0:
                selected_index = idx

        if not port_strings:
            self.port_combobox["values"] = ["Tidak ada port serial terdeteksi"]
            self.port_combobox.current(0)
            self.log("[WARN] Tidak ditemukan port serial. Pastikan kabel/radio terpasang.")
        else:
            self.port_combobox["values"] = port_strings
            self.port_combobox.current(selected_index)
            self.log(f"[INFO] Ditemukan {len(port_strings)} port serial.")

    def get_selected_port_name(self):
        val = self.port_combobox.get()
        if not val or "Tidak ada" in val:
            return None
        return val.split(":")[0].strip()

    def start_operation(self):
        port_name = self.get_selected_port_name()
        if not port_name:
            messagebox.showerror("Error", "Silakan pilih Port Serial yang valid.")
            return

        baud = int(self.baud_var.get())
        mode = self.mode_var.get()
        csv_rate = float(self.csv_rate_var.get())
        fetch_params = self.params_var.get()

        self.is_running = True
        self.stop_event.clear()
        self.btn_start.config(state=tk.DISABLED, bg="#81c784")
        self.btn_stop.config(state=tk.NORMAL)
        self.port_combobox.config(state=tk.DISABLED)
        self.baud_combobox.config(state=tk.DISABLED)
        self.tile_status.config(text="MENGHUBUNGKAN...", fg="#d69e2e")

        outdir = os.path.join(SCRIPT_DIR, f"pixhawk_{datetime.now():%Y%m%d_%H%M%S}")
        self.current_outdir = outdir

        def worker():
            try:
                # 1. Start router if in router mode
                if mode == "router":
                    self.log(f"[ROUTER] Membuka {port_name} @ {baud} baud ...")
                    self.router_instance = TelemetryRouter(
                        port=port_name,
                        baud=baud,
                        mp_port=config.ROUTER_PORT_MP,
                        logger_port=config.ROUTER_PORT_LOGGER,
                        bind_port=0,  # 0 = Otomatis pilih port bebas (mencegah WinError 10048)
                    )
                    self.router_instance.start_background()
                    self.log(f"[ROUTER] Berjalan! (Port lokal dinamis: {self.router_instance.actual_port})")
                    self.log("👉 Mission Planner dapat langsung Connect via UDP port 14550.")
                    time.sleep(0.5)

                # 2. Run Logger
                self.tile_status.config(text="MEREKAM", fg="#27ae60")
                use_router = (mode == "router")
                conn_arg = "auto" if not use_router else None

                def on_status_update(stats):
                    def _update_ui():
                        elapsed_s = int(stats.get("elapsed", 0))
                        hrs, rem = divmod(elapsed_s, 3600)
                        mins, secs = divmod(rem, 60)
                        time_str = f"{hrs:02d}:{mins:02d}:{secs:02d}"
                        self.tile_time.config(text=time_str)
                        self.tile_msgs.config(text=f"{stats.get('total', 0)} ({stats.get('types', 0)} tipe)")

                        if self.router_instance:
                            r_stats = self.router_instance.get_stats()
                            down_kb = r_stats["bytes_down"] / 1024.0
                            up_kb = r_stats["bytes_up"] / 1024.0
                            self.tile_traffic.config(text=f"↓{down_kb:.0f}K ↑{up_kb:.0f}K")
                    self.root.after(0, _update_ui)

                run_logger(
                    conn=port_name if not use_router else f"udpin:{config.ROUTER_HOST}:{config.ROUTER_PORT_LOGGER}",
                    baud=baud if not use_router else None,
                    router=use_router,
                    csv_rate=csv_rate,
                    params=fetch_params,
                    outdir=outdir,
                    stop_event=self.stop_event,
                    status_callback=on_status_update,
                    log_callback=self.log,
                )

            except Exception as e:
                self.log(f"[ERROR] {e}")
                self.root.after(0, lambda: messagebox.showerror("Error Perekaman", str(e)))
            finally:
                self.root.after(0, self._cleanup_after_stop)

        self.logger_thread = threading.Thread(target=worker, daemon=True)
        self.logger_thread.start()

    def stop_operation(self):
        if not self.is_running:
            return
        self.log("[INFO] Menghentikan proses perekaman dan router...")
        self.tile_status.config(text="MENUTUP FILE...", fg="#d69e2e")
        self.stop_event.set()
        if self.router_instance:
            self.router_instance.stop()
            self.router_instance = None

    def _cleanup_after_stop(self):
        if self.router_instance:
            try:
                self.router_instance.stop()
            except Exception:
                pass
            self.router_instance = None
        self.is_running = False
        self.btn_start.config(state=tk.NORMAL, bg="#2e7d32")
        self.btn_stop.config(state=tk.DISABLED)
        self.port_combobox.config(state="readonly")
        self.baud_combobox.config(state="readonly")
        self.tile_status.config(text="SELESAI / IDLE", fg="#4a5568")
        self.log("[OK] Sesi selesai. Seluruh file CSV tersimpan rapi.")

    def open_output_folder(self):
        folder = self.current_outdir if self.current_outdir and os.path.exists(self.current_outdir) else SCRIPT_DIR
        try:
            os.startfile(folder)
        except Exception as e:
            messagebox.showinfo("Folder Output", f"Lokasi folder:\n{folder}")

    def on_close(self):
        if self.is_running:
            if messagebox.askyesno("Konfirmasi Keluar", "Perekaman masih berjalan. Yakin ingin berhenti dan keluar?"):
                self.stop_operation()
                self.root.after(800, self.root.destroy)
        else:
            self.root.destroy()


def main():
    root = tk.Tk()
    app = TelemetryLoggerGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
