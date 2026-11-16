import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { useEffect, type ReactNode } from "react";
import type { LatLngExpression } from "leaflet";
import type { LatLon } from "../../utils/geo";

interface DroneMapProps {
  center: LatLon | null;
  zoom: number;
  children?: ReactNode;
}

function DroneView({ center, zoom }: { center: LatLon; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lon], zoom);
  }, [map, center.lat, center.lon, zoom]);
  return null;
}

export function DroneMap({ center, zoom, children }: DroneMapProps) {
  if (!center) {
    return <div className="map-container">Belum ada posisi GPS</div>;
  }
  return (
    <MapContainer center={[center.lat, center.lon] as LatLngExpression} zoom={zoom} className="map-container" scrollWheelZoom>
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <DroneView center={center} zoom={zoom} />
      {children}
    </MapContainer>
  );
}
