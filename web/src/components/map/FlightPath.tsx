import { Polyline } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import type { LatLon } from "../../utils/geo";

interface FlightPathProps {
  points: LatLon[];
}

export function FlightPath({ points }: FlightPathProps) {
  const coords: LatLngExpression[] = points
    .filter((p) => p.lat !== undefined && p.lon !== undefined)
    .map((p) => [p.lat, p.lon] as [number, number]);

  if (coords.length < 2) {
    return null;
  }

  return <Polyline positions={coords} color="#38bdf8" weight={3} opacity={0.8} />;
}
