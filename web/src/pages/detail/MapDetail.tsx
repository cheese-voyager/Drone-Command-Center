import { useEffect, useMemo, useState } from "react";
import { Card } from "../../components/ui/Card";
import { DroneMap } from "../../components/map/DroneMap";
import { DroneMarker } from "../../components/map/DroneMarker";
import { SiteMarker } from "../../components/map/SiteMarker";
import { FlightPath } from "../../components/map/FlightPath";
import { DropMarkers } from "../../components/map/DropMarkers";
import { WeatherMarker } from "../../components/map/WeatherMarker";
import { WeatherOverlay } from "../../components/weather/WeatherOverlay";
import { LineChart } from "../../components/charts/LineChart";
import { DetailEmpty, DetailMetrics } from "../../components/detail/DetailPrimitives";
import { LiveDroneStrip } from "../../components/telemetry/LiveDroneStrip";
import { useDroneStore } from "../../store/droneStore";
import { useDropHistory } from "../../hooks/useDropHistory";
import { useWeather } from "../../hooks/useWeather";
import { DEFAULT_MAP_CENTER } from "../../utils/constants";
import { exportFlightExcel, exportFlightPdf } from "../../utils/reports";
import { flightPathFromHistory, sampledPoints, summarizeFlight } from "../../utils/flight";
import { fmtCoord, fmtDateTime, fmtNumber } from "../../utils/format";

export function MapDetailPage() {
  const status = useDroneStore((state) => state.status);
  const history = useDroneStore((state) => state.history);
  const lastDrop = useDroneStore((state) => state.lastDrop);
  const drops = useDropHistory(lastDrop);
  const [showWeather, setShowWeather] = useState(true);
  const [showCharts, setShowCharts] = useState(false);

  const points = useMemo(() => flightPathFromHistory(history), [history]);
  const summary = useMemo(() => summarizeFlight(points, history, drops), [points, history, drops]);
  const track = useMemo(() => sampledPoints(points), [points]);
  const labels = useMemo(
    () => points.map((point) => new Date(point.time).toLocaleTimeString("id-ID", { hour12: false })),
    [points],
  );

  const center = status && status.lat !== null && status.lon !== null ? { lat: status.lat, lon: status.lon } : null;
  const mapCenter = center ?? DEFAULT_MAP_CENTER;
  const weather = useWeather(mapCenter.lat, mapCenter.lon);
  const durationText =
    summary.duration_s === null
      ? "-"
      : `${Math.floor(summary.duration_s / 60)}m${(summary.duration_s % 60).toFixed(1)}s`;

  useEffect(() => {
    const onPdf = () => exportFlightPdf(history, drops);
    const onExcel = () => exportFlightExcel(history, drops);
    window.addEventListener("dcc-export-pdf", onPdf);
    window.addEventListener("dcc-export-excel", onExcel);
    return () => {
      window.removeEventListener("dcc-export-pdf", onPdf);
      window.removeEventListener("dcc-export-excel", onExcel);
    };
  }, [history, drops]);

  return (
    <div className="detail-page">
      <LiveDroneStrip />

      <Card title="Ringkasan rute" meta="Akumulasi telemetri browser">
        <DetailMetrics
          items={[
            { label: "Titik rute", value: summary.points, sub: "Akumulasi sampel" },
            { label: "Jarak", value: `${fmtNumber(summary.distance_km, 2)} km`, sub: "Sesi telemetri" },
            { label: "Durasi", value: durationText, sub: "Sepanjang rute" },
            {
              label: "Ketinggian maks",
              value: summary.max_alt === null ? "-" : `${fmtNumber(summary.max_alt, 0)}m`,
              sub: "Sepanjang rute",
            },
          ]}
        />
      </Card>

      <div className="fit-2col" style={{ flex: "none", gap: "var(--space-4)" }}>
        <Card title="Drop" meta="GET/drops + MQTT">
          <b className="metric-value small">{drops.length} titik tercatat</b>
        </Card>
        <Card title="Posisi drone" meta="Telemetri GPS">
          <b className="metric-value small num">{fmtCoord(status?.lat ?? null, status?.lon ?? null)}</b>
        </Card>
      </div>

      <Card
        title="Peta lengkap"
        meta={center ? "Mengikuti posisi drone" : "Lokasi default ITENAS Bandung"}
        actions={
          <div className="page-actions">
            <button
              type="button"
              className="btn btn-secondary map-toggle"
              aria-pressed={showWeather}
              onClick={() => setShowWeather((value) => !value)}
            >
              Cuaca
            </button>
            <button
              type="button"
              className="btn btn-secondary map-toggle"
              aria-pressed={showCharts}
              onClick={() => setShowCharts((value) => !value)}
            >
              Grafik
            </button>
          </div>
        }
      >
        <div className="map-monitor-shell">
          <DroneMap center={mapCenter} zoom={16} className="map-monitor" showScale>
            <SiteMarker site={DEFAULT_MAP_CENTER} label="ITENAS Bandung" />
            {center ? <DroneMarker lat={center.lat} lon={center.lon} /> : null}
            <FlightPath points={track} />
            <DropMarkers drops={drops} />
            <WeatherMarker place={weather.location} />
          </DroneMap>
          {showWeather ? <WeatherOverlay weather={weather} lat={mapCenter.lat} lon={mapCenter.lon} /> : null}
        </div>
      </Card>

      {showCharts ? (
        <Card title="Profil jalur" meta="Ketinggian dan kecepatan terhadap waktu">
          <div className="fit-2col" style={{ flex: "none", gap: "var(--space-4)" }}>
            <LineChart
              series={[{ label: "Ketinggian", color: "var(--primary)", values: points.map((point) => point.alt) }]}
              labels={labels}
              height={140}
              format={(value) => `${value.toFixed(0)} m`}
            />
            <LineChart
              series={[{ label: "Kecepatan", color: "var(--warn)", values: points.map((point) => point.speed) }]}
              labels={labels}
              height={140}
              format={(value) => `${value.toFixed(1)} m/s`}
            />
          </div>
        </Card>
      ) : null}

      <Card
        title="Semua sampel rute"
        meta="Riwayat koordinat dari telemetri browser"
        actions={<span className="metric-sub">{history.length} titik</span>}
      >
        {history.length === 0 ? (
          <DetailEmpty>Belum ada sampel rute. Data akan muncul saat telemetri GPS diterima.</DetailEmpty>
        ) : (
          <div className="scroll-y">
            <table className="table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Koordinat</th>
                  <th>Alt</th>
                  <th>Speed</th>
                </tr>
              </thead>
              <tbody>
                {history
                  .slice()
                  .reverse()
                  .slice(0, 80)
                  .map((sample) => (
                    <tr key={`${sample.time}-${sample.lat}-${sample.lon}`}>
                      <td className="num">{fmtDateTime(sample.time / 1000)}</td>
                      <td className="num">{fmtCoord(sample.lat, sample.lon)}</td>
                      <td className="num">{fmtNumber(sample.alt, 1)}</td>
                      <td className="num">{fmtNumber(sample.speed, 1)} m/s</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Semua titik drop" meta="GET/drops + MQTT">
        {drops.length === 0 ? (
          <DetailEmpty>Belum ada drop benih.</DetailEmpty>
        ) : (
          <div className="scroll-y">
            <table className="table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Koordinat</th>
                  <th>Thrust</th>
                  <th>Durasi</th>
                </tr>
              </thead>
              <tbody>
                {drops
                  .slice()
                  .reverse()
                  .slice(0, 12)
                  .map((drop) => (
                    <tr key={`${drop.time}-${drop.lat}-${drop.lon}`}>
                      <td className="num">{fmtDateTime(drop.time)}</td>
                      <td className="num">{fmtCoord(drop.lat, drop.lon)}</td>
                      <td className="num">{fmtNumber(drop.thrust, 0)}%</td>
                      <td className="num">{fmtNumber(drop.duration, 1)} s</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
