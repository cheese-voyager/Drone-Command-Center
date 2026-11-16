import { Marker } from "react-leaflet";
import L from "leaflet";
import type { LatLngExpression } from "leaflet";
import type { DropRecord } from "../../types";

interface DropMarkersProps {
  drops: DropRecord[];
}

export function DropMarkers({ drops }: DropMarkersProps) {
  const points = drops.filter((d) => d.lat !== null && d.lon !== null);

  if (points.length === 0) {
    return null;
  }

  return (
    <>
      {points.map((drop, index) => (
        <Marker
          key={drop.time}
          position={[drop.lat as number, drop.lon as number] as LatLngExpression}
          icon={L.divIcon({
            className: "",
            html: `<div class="drop-marker${index === 0 ? " first" : ""}"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          })}
        />
      ))}
    </>
  );
}
