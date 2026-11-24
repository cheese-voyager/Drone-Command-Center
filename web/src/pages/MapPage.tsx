import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "../components/ui/Card";
import { DroneMap } from "../components/map/DroneMap";
import { DroneMarker } from "../components/map/DroneMarker";
import { SiteMarker } from "../components/map/SiteMarker";
import { DropMarkers } from "../components/map/DropMarkers";
import { FlightPath } from "../components/map/FlightPath";
import { WeatherMarker } from "../components/map/WeatherMarker";
import { WeatherOverlay } from "../components/weather/WeatherOverlay";
import { LineChart } from "../components/charts/LineChart";
import { LiveDroneStrip } from "../components/telemetry/LiveDroneStrip";
import { useDropHistory } from "../hooks/useDropHistory";
import { useWeather } from "../hooks/useWeather";
import { useDroneStore } from "../store/droneStore";
import { DEFAULT_MAP_CENTER } from "../utils/constants";
import { exportFlightExcel, exportFlightPdf } from "../utils/reports";
import { flightPathFromHistory, summarizeFlight } from "../utils/flight";
import { fmtDuration, fmtNumber } from "../utils/format";
import { PageHeader } from "../components/layout/PageHeader";

export function MapPage() {
  const drone = useDroneStore((state) => state.status);
  const lastDrop = useDroneStore((state) => state.lastDrop);
  const history = useDroneStore((state) => state.history);
  const drops = useDropHistory(lastDrop);
  const [showCharts, setShowCharts] = useState(false);
  const [showWeather, setShowWeather] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);

  const points = useMemo(() => flightPathFromHistory(history), [history]);
  const summary = useMemo(() => summarizeFlight(points, history, drops), [points, history, drops]);
  const labels = useMemo(
    () => points.map((point) => new Date(point.time).toLocaleTimeString("id-ID", { hour12: false })),
    [points],
  );
  const center = drone && drone.lat !== null && drone.lon !== null ? { lat: drone.lat, lon: drone.lon } : null;
  const mapCenter = center ?? DEFAULT_MAP_CENTER;
  const weather = useWeather(mapCenter.lat, mapCenter.lon);
  const canExport = points.length > 0 || drops.length > 0;

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      const exit = document.exitFullscreen();
      if (exit) void exit.catch(() => undefined);
      return;
    }
    const request = shellRef.current?.requestFullscreen?.();
    if (request) void request.catch(() => undefined);
  };

  return (
    <div className="page-fit">
      <PageHeader
        className="feature-page-head"
        eyebrow="Operasi geospasial"
        title="Peta"
        description={
          <>
            Pantau posisi drone, jejak terbang, dan sebaran titik drop dalam satu layar. Data diperbarui dari MQTT
            status, riwayat telemetri browser, dan endpoint drops.
          </>
        }
        detail={{ label: "Detail peta", to: "/detail/peta" }}
        meta={
          <div className="page-stats" aria-label="Ringkasan peta">
            <span>
              <i className="dot drone" />
              Titik <b>{points.length}</b>
            </span>
            <span>
              <i className="line" />
              Jarak <b>{fmtNumber(summary.distance_km, 2)} km</b>
            </span>
            <span>
              <i className="dot drop" />
              Drop <b>{drops.length}</b>
            </span>
            <span>
              Maks alt <b>{summary.max_alt === null ? "-" : `${fmtNumber(summary.max_alt, 0)} m`}</b>
            </span>
            <span>
              Status <b>{drone ? (drone.armed ? "Armed" : "Standby") : "Menunggu data"}</b>
            </span>
          </div>
        }
        source="MQTT · telemetri · GET /drops"
        legend={[
          { label: "Drone" },
          { label: "Rute", tone: "route" },
          { label: "Drop", tone: "drop" },
          { label: "Cuaca", tone: "weather" },
        ]}
        actions={
          <>
            <button
              className="btn btn-secondary btn-sm map-toggle"
              aria-pressed={showWeather}
              onClick={() => setShowWeather((value) => !value)}
            >
              Cuaca
            </button>
            <button
              className="btn btn-secondary btn-sm map-toggle"
              aria-pressed={showCharts}
              onClick={() => setShowCharts((value) => !value)}
            >
              Grafik
            </button>
            <button className="btn btn-secondary btn-sm" onClick={toggleFullscreen}>
              {fullscreen ? "Keluar layar penuh" : "Layar penuh"}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => exportFlightPdf(history, drops)} disabled={!canExport}>
              Ekspor PDF
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => exportFlightExcel(history, drops)} disabled={!canExport}>
              Ekspor Excel
            </button>
          </>
        }
      />

      <LiveDroneStrip />

      <div className="map-monitor-shell" ref={shellRef}>
        <DroneMap center={mapCenter} zoom={16} className="map-monitor" showScale>
          <SiteMarker site={DEFAULT_MAP_CENTER} label="ITENAS Bandung" />
          {center ? <DroneMarker lat={center.lat} lon={center.lon} /> : null}
          <FlightPath points={points} />
          <DropMarkers drops={drops} />
          <WeatherMarker place={weather.location} />
        </DroneMap>

        {showWeather ? (
          <WeatherOverlay weather={weather} lat={mapCenter.lat} lon={mapCenter.lon} />
        ) : null}
      </div>

      {showCharts ? (
        <Card
          title="Profil jalur"
          meta={`${fmtDuration(summary.duration_s)} · maks ${summary.max_alt === null ? "-" : `${fmtNumber(summary.max_alt, 0)} m`}`}
          className="map-profile-card"
        >
          <div className="fit-2col" style={{ flex: "none", gap: "var(--space-4)" }}>
            <LineChart
              series={[{ label: "Ketinggian", color: "var(--primary)", values: points.map((point) => point.alt) }]}
              labels={labels}
              height={88}
              format={(value) => `${value.toFixed(0)} m`}
            />
            <LineChart
              series={[{ label: "Kecepatan", color: "var(--warn)", values: points.map((point) => point.speed) }]}
              labels={labels}
              height={88}
              format={(value) => `${value.toFixed(1)} m/s`}
            />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
