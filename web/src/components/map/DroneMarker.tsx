import { Marker } from "react-leaflet";
import L from "leaflet";
import type { LatLngExpression } from "leaflet";

interface DroneMarkerProps {
  lat: number;
  lon: number;
}

export function DroneMarker({ lat, lon }: DroneMarkerProps) {
  const icon = L.divIcon({
    className: "",
    html: '<div class="drone-marker"></div>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

  return <Marker position={[lat, lon] as LatLngExpression} icon={icon} />;
}
