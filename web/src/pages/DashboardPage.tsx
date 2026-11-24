import type { ReactNode } from "react";
import { Card } from "../components/ui/Card";
import { Stat } from "../components/ui/Stat";
import { BatteryGauge } from "../components/telemetry/BatteryGauge";
import { FlightTimeEstimate } from "../components/telemetry/FlightTimeEstimate";
import { ImuAttitude } from "../components/telemetry/ImuAttitude";
import { DroneMap } from "../components/map/DroneMap";
import { SiteMarker } from "../components/map/SiteMarker";
import { DropButton } from "../components/drop/DropButton";
import { SeedCounter } from "../components/seed/SeedCounter";
import { WeatherCard } from "../components/weather/WeatherCard";
import { useDroneStore } from "../store/droneStore";
import { useWeather } from "../hooks/useWeather";
import { DEFAULT_MAP_CENTER, GPS_FIX_NAMES } from "../utils/constants";
import { fmtCoord, fmtNumber } from "../utils/format";
import { DetailLink } from "../components/detail/DetailLink";
import { PageHeader } from "../components/layout/PageHeader";

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
  const mapCenter = center ?? DEFAULT_MAP_CENTER;
  const fixLabel = drone?.gps_fix == null ? "-" : GPS_FIX_NAMES[drone.gps_fix] ?? "-";
  const weather = useWeather(mapCenter.lat, mapCenter.lon);

  return (
    <div className="dash-fit">
      {error ? <div className="banner banner-error">{error}</div> : null}
      {!backendOnline ? <div className="banner banner-warning">Backend offline. Telemetri akan ditandai basi.</div> : null}
      {stale ? <div className="banner banner-warning">Data telemetri belum diperbarui. Cek koneksi backend.</div> : null}

      <PageHeader
        className="feature-page-head"
        eyebrow="Operasional drone"
        title="Dashboard"
        description="Ringkasan langsung seluruh subsistem drone. Pantau telemetri, peta, payload, daya, dan cuaca dari satu layar, lalu buka detail tiap fitur untuk data lengkap."
        detail={{ label: "Detail status", to: "/detail/status" }}
        meta={
          <div className="page-stats" aria-label="Ringkasan drone">
            <span>
              Mode <b>{drone?.mode ?? "-"}</b>
            </span>
            <span>
              Baterai <b>{fmtNumber(battery?.remaining_percent ?? null, 0)}%</b>
            </span>
            <span>
              GPS <b>{fixLabel}</b>
            </span>
            <span>
              Ketinggian <b>{fmtNumber(drone?.alt ?? null)} m</b>
            </span>
            <span>
              Kecepatan <b>{fmtNumber(drone?.speed ?? null)} m/s</b>
            </span>
          </div>
        }
        source="MQTT status · telemetri browser"
        legend={[
          { label: "Telemetri", tone: "info" },
          { label: "Peta", tone: "drone" },
          { label: "Drop", tone: "drop" },
          { label: "Cuaca", tone: "weather" },
        ]}
      />

      <div className="dash-grid">
        <div className="dk-kpi">
          <Stat label="Ketinggian" value={fmtNumber(drone?.alt ?? null)} unit="m" sub={`Rata-rata ${fmtNumber(drone?.avg_speed ?? null)} m/s`} icon={<Ico d="m3 20 6-10 4 6 3-4 5 8z" />} />
          <Stat label="Kecepatan" value={fmtNumber(drone?.speed ?? null)} unit="m/s" sub="Kecepatan darat" icon={<Ico d="M12 14l4-5M4 18a9 9 0 1 1 16 0" />} />
          <Stat label="Heading" value={fmtNumber(drone?.yaw ?? null, 0)} unit="°" sub="Yaw" icon={<Ico d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.5 8.5l-2 5-5 2 2-5z" />} />
          <Stat label="GPS" value={fixLabel} unit={drone?.satellites != null ? `${Math.round(drone.satellites)} sat` : undefined} sub={fmtCoord(drone?.lat ?? null, drone?.lon ?? null)} icon={<Ico d="M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4" />} />
          <Stat label="Tegangan" value={fmtNumber(drone?.voltage ?? null, 1)} unit="V" sub={`${fmtNumber(drone?.current ?? null)} A · rata-rata ${fmtNumber(battery?.avg_current ?? null)} A`} icon={<Ico d="M13 2 4 14h7l-1 8 9-12h-7z" />} />
        </div>

        <Card title="Peta langsung" meta="Auto-center" className="dk-map" actions={<DetailLink to="/detail/peta" label="Buka detail peta" />}>
          <DroneMap center={mapCenter} zoom={17} className="hero">
            <SiteMarker site={DEFAULT_MAP_CENTER} label="ITENAS Bandung" />
          </DroneMap>
        </Card>

        <div className="dk-bottom">
          <Card title="Output motor" meta="4 motor" actions={<DetailLink to="/detail/thruster" label="Buka detail thruster" />}>
            {motors ? (
              <div className="motor-grid">
                {motors.map((m) => (
                  <div key={m.id} className="motor-mini">
                    <span>M{m.id}</span>
                    <div className={`bar${m.percent < 30 ? " warn" : ""}`}>
                      <span style={{ width: `${Math.max(0, Math.min(100, m.percent))}%` }} />
                    </div>
                    <span className="m-pct">{m.percent.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Belum ada data motor.</p>
            )}
          </Card>
          <Card title="Drop benih" actions={<DetailLink to="/detail/drop" label="Buka detail drop benih" />}>
            <div className="flex" style={{ flexDirection: "column", gap: "6px" }}>
              <DropButton />
              <p className="hint">Dialog konfirmasi muncul sebelum drop.</p>
            </div>
          </Card>
          <SeedCounter />
          <FlightTimeEstimate minutes={battery?.estimated_minutes_left ?? null} />
        </div>

        <div className="dk-side">
          <ImuAttitude pitch={drone?.pitch ?? null} roll={drone?.roll ?? null} yaw={drone?.yaw ?? null} />
          <Card title="Daya" meta="Baterai" actions={<DetailLink to="/detail/baterai" label="Buka detail baterai" />}>
            <div className="flex center" style={{ gap: "var(--space-3)" }}>
              <BatteryGauge percent={battery?.remaining_percent ?? 0} size={96} />
              <div className="flex" style={{ flexDirection: "column", gap: "6px", minWidth: 0 }}>
                <PowerRow label="Sisa kapasitas">{fmtNumber(battery?.remaining_mah ?? null, 0)} mAh</PowerRow>
                <PowerRow label="Arus rata-rata">{fmtNumber(battery?.avg_current ?? null)} A</PowerRow>
              </div>
            </div>
          </Card>
          <WeatherCard
            weather={weather}
            lat={mapCenter.lat}
            lon={mapCenter.lon}
            locationLabel={center ? "drone" : "titik pantau"}
            className="wx-card"
            maxSlots={6}
          />
        </div>
      </div>
    </div>
  );
}
