import type { ReactNode } from "react";
import { Card } from "../components/ui/Card";
import { Stat } from "../../../../Drone-Command-Center/web/src/components/ui/Stat";
import { BatteryGauge } from "../components/telemetry/BatteryGauge";
import { FlightTimeEstimate } from "../components/telemetry/FlightTimeEstimate";
import { ImuAttitude } from "../components/telemetry/ImuAttitude";
import { DroneMap } from "../components/map/DroneMap";
import { DropButton } from "../components/drop/DropButton";
import { SeedCounter } from "../components/seed/SeedCounter";
import { useDroneStore } from "../store/droneStore";
import { GPS_FIX_NAMES } from "../utils/constants";
import { fmtCoord, fmtNumber } from "../utils/format";

function Ico({ d }: { d: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function PowerRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <span className="metric-value small">{children}</span>
    </div>
  );
}

export function DashboardPage() {
  const drone = useDroneStore((state) => state.status);
  const backendOnline = useDroneStore((state) => state.backendOnline);
  const stale = useDroneStore((state) => state.stale);
  const error = useDroneStore((state) => state.error);
  const battery = drone?.battery;
  const motors = drone?.motors;
  const center = drone && drone.lat !== null && drone.lon !== null ? { lat: drone.lat, lon: drone.lon } : null;
  const fixLabel = drone?.gps_fix == null ? "-" : GPS_FIX_NAMES[drone.gps_fix] ?? "-";

  return (
    <div>
      {error ? <div className="banner banner-error">{error}</div> : null}
      {!backendOnline ? <div className="banner banner-warning">Backend offline. Telemetri akan ditandai basi.</div> : null}
      {stale ? <div className="banner banner-warning">Data telemetri belum diperbarui. Cek koneksi backend.</div> : null}

      <div className="dash">
        <div className="dash-col">
          <div className="kpi-strip">
            <Stat label="Ketinggian" value={fmtNumber(drone?.alt ?? null)} unit="m" sub={`Rata-rata kecepatan ${fmtNumber(drone?.avg_speed ?? null)} m/s`} icon={<Ico d="m3 20 6-10 4 6 3-4 5 8z" />} />
            <Stat label="Kecepatan" value={fmtNumber(drone?.speed ?? null)} unit="m/s" sub="Kecepatan darat" icon={<Ico d="M12 14l4-5M4 18a9 9 0 1 1 16 0" />} />
            <Stat label="Heading" value={fmtNumber(drone?.yaw ?? null, 0)} unit="°" sub="Yaw" icon={<Ico d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.5 8.5l-2 5-5 2 2-5z" />} />
            <Stat label="GPS" value={fixLabel} unit={drone?.satellites != null ? `${Math.round(drone.satellites)} sat` : undefined} sub={fmtCoord(drone?.lat ?? null, drone?.lon ?? null)} icon={<Ico d="M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4" />} />
            <Stat label="Tegangan" value={fmtNumber(drone?.voltage ?? null, 1)} unit="V" sub={`${fmtNumber(drone?.current ?? null)} A  ·  rata-rata ${fmtNumber(battery?.avg_current ?? null)} A`} icon={<Ico d="M13 2 4 14h7l-1 8 9-12h-7z" />} />
          </div>

          <Card title="Peta live" meta="Auto-center">
            <DroneMap center={center} zoom={17} className="hero" />
          </Card>

          <div className="dash-bottom">
            <Card title="Output motor" meta="4 motor">
              {motors ? (
                motors.map((m) => (
                  <div key={m.id} className="motor-row">
                    <span>M{m.id}</span>
                    <div className={`bar${m.percent < 30 ? " warn" : ""}`}>
                      <span style={{ width: `${Math.max(0, Math.min(100, m.percent))}%` }} />
                    </div>
                    <span>{m.percent.toFixed(1)}%</span>
                  </div>
                ))
              ) : (
                <p className="muted">Belum ada data motor.</p>
              )}
            </Card>
            <Card title="Tebar benih">
              <div className="flex" style={{ flexDirection: "column", gap: "var(--space-3)" }}>
                <DropButton />
                <p className="hint">Dialog konfirmasi muncul sebelum drop dijalankan.</p>
              </div>
            </Card>
          </div>
        </div>

        <div className="dash-col">
          <ImuAttitude pitch={drone?.pitch ?? null} roll={drone?.roll ?? null} yaw={drone?.yaw ?? null} />
          <Card title="Daya" meta="Baterai">
            <div className="flex center" style={{ gap: "var(--space-4)" }}>
              <BatteryGauge percent={battery?.remaining_percent ?? 0} />
              <div className="flex" style={{ flexDirection: "column", gap: "var(--space-3)" }}>
                <PowerRow label="Sisa kapasitas">{fmtNumber(battery?.remaining_mah ?? null, 0)} mAh</PowerRow>
                <PowerRow label="Arus rata-rata">{fmtNumber(battery?.avg_current ?? null)} A</PowerRow>
              </div>
            </div>
          </Card>
          <SeedCounter />
          <FlightTimeEstimate minutes={battery?.estimated_minutes_left ?? null} />
        </div>
      </div>
    </div>
  );
}
