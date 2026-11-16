import { Card } from "../components/ui/Card";
import { BatteryGauge } from "../components/telemetry/BatteryGauge";
import { AltitudeCard } from "../components/telemetry/AltitudeCard";
import { FlightTimeEstimate } from "../components/telemetry/FlightTimeEstimate";
import { GpsStatusCard } from "../components/telemetry/GpsStatusCard";
import { ImuAttitude } from "../components/telemetry/ImuAttitude";
import { VoltageCurrentCard } from "../components/telemetry/VoltageCurrentCard";
import { DroneMap } from "../components/map/DroneMap";
import { DropButton } from "../components/drop/DropButton";
import { SeedCounter } from "../components/seed/SeedCounter";
import { useDroneStore } from "../store/droneStore";
import { fmtNumber } from "../utils/format";

export function DashboardPage() {
  const status = useDroneStore((state) => state.status);
  const backendOnline = useDroneStore((state) => state.backendOnline);
  const stale = useDroneStore((state) => state.stale);
  const error = useDroneStore((state) => state.error);
  const drone = status;
  const battery = drone?.battery;
  const motors = drone?.motors;
  const center = drone && drone.lat !== null && drone.lon !== null ? { lat: drone.lat, lon: drone.lon } : null;

  return (
    <div>
      {error ? <div className="banner banner-error">{error}</div> : null}
      {!backendOnline ? <div className="banner banner-warning">Backend offline. Telemetry akan ditandai basi.</div> : null}
      {stale ? <div className="banner banner-warning">Data telemetry belum diperbarui. Cek koneksi backend.</div> : null}

      <div className="page-head">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">Monitor operasional drone penebar benih.</p>
        </div>
      </div>

      <div className="grid grid-4">
        <Card title="Baterai">
          <div className="flex center" style={{ flexDirection: "column", gap: "var(--space-3)" }}>
            <BatteryGauge percent={battery?.remaining_percent ?? 0} />
            <span className="metric-sub">
              Sisa {fmtNumber(battery?.remaining_percent)}% · {fmtNumber(battery?.remaining_mah)} mAh
            </span>
          </div>
        </Card>
        <SeedCounter />
        <GpsStatusCard gpsFix={drone?.gps_fix ?? null} satellites={drone?.satellites ?? null} lat={drone?.lat ?? null} lon={drone?.lon ?? null} />
        <VoltageCurrentCard voltage={drone?.voltage ?? null} current={drone?.current ?? null} avgCurrent={battery?.avg_current ?? null} />
      </div>

      <div className="grid grid-2" style={{ marginTop: "var(--space-4)" }}>
        <AltitudeCard alt={drone?.alt ?? null} speed={drone?.speed ?? null} avgSpeed={drone?.avg_speed ?? null} />
        <ImuAttitude pitch={drone?.pitch ?? null} roll={drone?.roll ?? null} yaw={drone?.yaw ?? null} />
      </div>

      <div className="grid grid-2" style={{ marginTop: "var(--space-4)" }}>
        <Card title="Motor Penggerak">
          {motors ? (
            motors.map((m) => (
              <div key={m.id} className="motor-row">
                <span>Motor {m.id}</span>
                <div className={`bar${m.percent < 30 ? " warn" : ""}`}>
                  <span style={{ width: `${Math.max(0, Math.min(100, m.percent))}%` }} />
                </div>
                <span className="mono">{m.percent.toFixed(1)}%</span>
              </div>
            ))
          ) : (
            <p className="muted">Belum ada data motor.</p>
          )}
        </Card>
        <Card title="Live Map">
          <DroneMap center={center} zoom={15} />
        </Card>
      </div>

      <div className="grid grid-2" style={{ marginTop: "var(--space-4)" }}>
        <Card title="Estimasi Waktu Terbang">
          <FlightTimeEstimate minutes={battery?.estimated_minutes_left ?? null} />
        </Card>
        <Card title="Benih">
          <SeedCounter />
        </Card>
      </div>

      <div style={{ marginTop: "var(--space-4)" }}>
        <DropButton />
      </div>
    </div>
  );
}
