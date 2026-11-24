import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { ConnectionStatus } from "./ConnectionStatus";
import { MissionPlannerGroups } from "../detail/MissionPlannerGroups";
import { useStatusSnapshot } from "../../hooks/useStatusSnapshot";
import { useDroneStore } from "../../store/droneStore";
import { GPS_FIX_NAMES } from "../../utils/constants";
import { fmtClock, fmtNumber } from "../../utils/format";

interface DetailHeaderConfig {
  eyebrow: string;
  title: string;
  description: string;
  source: string;
  main?: { label: string; to: string };
  related?: { label: string; to: string };
  exports?: boolean;
}

const HEADERS: Record<string, DetailHeaderConfig> = {
  "/detail/status": {
    eyebrow: "Telemetri langsung",
    title: "Status lengkap",
    description: "Posisi, navigasi, daya, dan kesehatan perangkat secara real-time.",
    source: "MQTT status · Mission Planner",
    main: { label: "Kembali ke Dashboard", to: "/" },
    related: { label: "Detail peta", to: "/detail/peta" },
  },
  "/detail/peta": {
    eyebrow: "Operasi geospasial",
    title: "Peta lengkap",
    description: "Posisi drone, jejak rute, titik drop, dan ekspor laporan penerbangan.",
    source: "GET /drops · MQTT · telemetri browser",
    main: { label: "Kembali ke Peta", to: "/peta" },
    related: { label: "Detail status", to: "/detail/status" },
    exports: true,
  },
  "/detail/drop": {
    eyebrow: "Operasi payload",
    title: "Drop benih",
    description: "Kesiapan drop, titik penebaran, dan konfigurasi servo aktif.",
    source: "GET /drops · MQTT status · MQTT drop_event",
    main: { label: "Kembali ke Drop benih", to: "/drop" },
    related: { label: "Detail peta", to: "/detail/peta" },
  },
  "/detail/thruster": {
    eyebrow: "Pemeliharaan aktuator",
    title: "Tes thruster dan motor",
    description: "Pengujian motor dengan pengaman disarmed dan batas daya.",
    source: "MQTT status · Mission Planner servo",
    main: { label: "Kembali ke Tes thruster", to: "/thruster" },
    related: { label: "Detail status", to: "/detail/status" },
  },
  "/detail/baterai": {
    eyebrow: "Kesehatan armada",
    title: "Baterai dan daya",
    description: "Kapasitas, tegangan, arus, dan estimasi waktu operasi tersisa.",
    source: "MQTT status · telemetri browser",
    main: { label: "Kembali ke Baterai", to: "/baterai" },
    related: { label: "Detail status", to: "/detail/status" },
  },
  "/detail/benih": {
    eyebrow: "Inventaris payload",
    title: "Benih",
    description: "Sisa stok, komposisi benih, dan riwayat pemakaian.",
    source: "MQTT status · telemetri browser",
    main: { label: "Kembali ke Benih", to: "/benih" },
    related: { label: "Detail status", to: "/detail/status" },
  },
  "/detail/video": {
    eyebrow: "Operasi visual",
    title: "Kamera",
    description: "Pratinjau langsung dari stream kamera dan metadata perangkat.",
    source: "GET /video · MQTT status",
    main: { label: "Kembali ke Kamera", to: "/video" },
    related: { label: "Detail status", to: "/detail/status" },
  },
  "/detail/cuaca": {
    eyebrow: "Kondisi lingkungan",
    title: "Cuaca",
    description: "Prakiraan BMKG dan penilaian risiko untuk penerbangan.",
    source: "BMKG · MQTT status",
    main: { label: "Kembali ke Cuaca", to: "/cuaca" },
    related: { label: "Detail peta", to: "/detail/peta" },
  },
  "/detail/penerbangan": {
    eyebrow: "Analitik penerbangan",
    title: "Riwayat penerbangan",
    description: "Sesi terbang, jarak tempuh, durasi, dan profil ketinggian.",
    source: "localStorage browser",
    main: { label: "Kembali ke Riwayat", to: "/flights" },
    related: { label: "Detail peta", to: "/detail/peta" },
  },
};

const DEFAULT_HEADER: DetailHeaderConfig = {
  eyebrow: "Operasional drone",
  title: "Detail",
  description: "Ringkasan langsung perangkat dan misi drone.",
  source: "MQTT status",
  main: { label: "Kembali ke Dashboard", to: "/" },
};

export function DetailLayout() {
  useStatusSnapshot();
  const location = useLocation();
  const status = useDroneStore((state) => state.status);
  const lastStatusAt = useDroneStore((state) => state.lastStatusAt);
  const historyCount = useDroneStore((state) => state.history.length);
  const dropCount = useDroneStore((state) => state.drops.length);
  const canExport = historyCount > 0 || dropCount > 0;
  const shellRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const config = HEADERS[location.pathname] ?? DEFAULT_HEADER;

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await shellRef.current?.requestFullscreen();
  };

  const fixLabel = status?.gps_fix == null ? "-" : GPS_FIX_NAMES[status.gps_fix] ?? "-";

  return (
    <div className="detail-shell" ref={shellRef}>
      <header className="detail-header">
        <div className="detail-topline">
          <div className="detail-brand">
            <span className="detail-brand-mark">AV</span>
            <span className="detail-brand-copy">
              <b>Astra Versa</b>
              <small>Ground station</small>
            </span>
          </div>
          <div className="detail-topline-actions">
            <span className="detail-clock num">Diperbarui {lastStatusAt ? fmtClock(lastStatusAt / 1000) : "--:--:--"}</span>
            <ConnectionStatus />
          </div>
        </div>
        <div className="detail-mainline">
          <div className="detail-header-title">
            <nav className="detail-breadcrumb" aria-label="Breadcrumb">
              <Link to="/">Dashboard</Link>
              <span>/</span>
              <span>Detail</span>
              <span>/</span>
              <span aria-current="page">{config.title}</span>
            </nav>
            <span className="detail-eyebrow">{config.eyebrow}</span>
            <h1 className="detail-title">{config.title}</h1>
            <p className="detail-description">{config.description}</p>
            <div className="page-stats detail-stats" aria-label="Ringkasan detail">
              <span>
                Mode <b>{status?.mode ?? "-"}</b>
              </span>
              <span>
                Baterai <b>{fmtNumber(status?.battery.remaining_percent ?? null, 0)}%</b>
              </span>
              <span>
                GPS <b>{fixLabel}</b>
              </span>
              <span>
                Sampel <b>{historyCount}</b>
              </span>
              <span>
                Drop <b>{dropCount}</b>
              </span>
            </div>
            <div className="page-context">
              <span className="page-source">{config.source}</span>
              <div className="page-legend" aria-label="Legenda detail">
                <span>
                  <i className="legend-mark info" aria-hidden />
                  Status
                </span>
                <span>
                  <i className="legend-mark route" aria-hidden />
                  Rute
                </span>
                <span>
                  <i className="legend-mark drop" aria-hidden />
                  Payload
                </span>
              </div>
            </div>
          </div>
          <div className="detail-header-actions">
            {config.main ? (
              <Link className="btn btn-ghost btn-sm" to={config.main.to}>
                {config.main.label}
              </Link>
            ) : null}
            {config.related ? (
              <Link className="btn btn-ghost btn-sm" to={config.related.to}>
                {config.related.label}
              </Link>
            ) : null}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void toggleFullscreen()}>
              {fullscreen ? "Keluar layar penuh" : "Layar penuh"}
            </button>
            {config.exports ? (
              <>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => window.dispatchEvent(new Event("dcc-export-pdf"))}
                  disabled={!canExport}
                >
                  Ekspor PDF
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => window.dispatchEvent(new Event("dcc-export-excel"))}
                  disabled={!canExport}
                >
                  Ekspor Excel
                </button>
              </>
            ) : null}
          </div>
        </div>
      </header>
      <main className="app-content app-main detail-body">
        <Outlet />
        <MissionPlannerGroups />
      </main>
    </div>
  );
}
