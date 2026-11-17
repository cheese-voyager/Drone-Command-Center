import { useEffect, useRef, useState } from "react";
import { Card } from "../components/ui/Card";
import { Stat } from "../../../../Drone-Command-Center/web/src/components/ui/Stat";
import { DroneMap } from "../components/map/DroneMap";
import { DroneMarker } from "../components/map/DroneMarker";
import { DropMarkers } from "../components/map/DropMarkers";
import { FlightPath } from "../components/map/FlightPath";
import { useDropHistory } from "../hooks/useDropHistory";
import { useDroneStore } from "../store/droneStore";
import { fmtInt, fmtNumber } from "../utils/format";
import type { LatLon } from "../utils/geo";


export function MapPage() {
  const drone = useDroneStore((state) => state.status);
  const lastDrop = useDroneStore((state) => state.lastDrop);
  const drops = useDropHistory(lastDrop);
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
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title">Peta</h1>
          <p className="page-sub">Posisi drone, jejak terbang, dan titik drop.</p>
        </div>
      </div>
      <Card title="Peta live" meta={`${path.length} titik jejak`}>
        <DroneMap center={center} zoom={16} className="tall">
          {center ? <DroneMarker lat={center.lat} lon={center.lon} /> : null}
          <FlightPath points={path} />
          <DropMarkers drops={drops} />
        </DroneMap>
      </Card>
      <div className="kpi-strip" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        <Stat label="Titik drop" value={String(drops.length)} />
        <Stat label="Sisa benih" value={fmtInt(drone?.seed?.remaining)} />
        <Stat label="Sudah di-drop" value={fmtInt(drone?.seed?.dropped)} />
        <Stat label="Sisa baterai" value={fmtNumber(drone?.battery?.remaining_percent)} unit="%" />
      </div>
    </div>
  );
}
