import { useEffect, useRef, useState } from "react";
import { DroneMap } from "../components/map/DroneMap";
import { DroneMarker } from "../components/map/DroneMarker";
import { DropMarkers } from "../components/map/DropMarkers";
import { FlightPath } from "../components/map/FlightPath";
import { useDroneStatus } from "../hooks/useDroneStatus";
import { useDroneStore } from "../store/droneStore";
import type { LatLon } from "../utils/geo";

export function MapPage() {
  const { status: drone } = useDroneStatus();
  const drops = useDroneStore((state) => state.drops);
  const [path, setPath] = useState<LatLon[]>([]);
  const lastRef = useRef<LatLon | null>(null);

  useEffect(() => {
    const d = drone;
    if (!d || d.lat === null || d.lon === null) {
      return;
    }
    const current: LatLon = { lat: d.lat, lon: d.lon };
    const previous = lastRef.current;
    if (previous && (previous.lat !== current.lat || previous.lon !== current.lon)) {
      setPath((pts) => [...pts.slice(-500), current]);
    }
    lastRef.current = current;
  }, [drone]);

  const center = drone && drone.lat !== null && drone.lon !== null ? { lat: drone.lat, lon: drone.lon } : null;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Peta</h1>
          <p className="page-sub">Posisi drone, jejak terbang, dan titik drop.</p>
        </div>
      </div>
      <div className="map-container">
        <DroneMap center={center} zoom={15}>
          {center ? <DroneMarker lat={center.lat} lon={center.lon} /> : null}
          <FlightPath points={path} />
          <DropMarkers drops={drops} />
        </DroneMap>
      </div>
      <div className="grid grid-4" style={{ marginTop: "var(--space-4)" }}>
        <div className="card card-pad metric">
          <span className="metric-label">Titik Drop</span>
          <span className="metric-value small">{drops.length}</span>
        </div>
        <div className="card card-pad metric">
          <span className="metric-label">Sisa Benih</span>
          <span className="metric-value small">{drone?.seed.remaining}</span>
        </div>
        <div className="card card-pad metric">
          <span className="metric-label">Tingkatkan</span>
          <span className="metric-value small">{drone?.seed.dropped}</span>
        </div>
        <div className="card card-pad metric">
          <span className="metric-label">Sisa Baterai</span>
          <span className="metric-value small">{drone?.battery.remaining_percent?.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}
