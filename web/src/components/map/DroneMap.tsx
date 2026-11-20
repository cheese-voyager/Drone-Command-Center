import { MapContainer, ScaleControl, TileLayer, useMap } from "react-leaflet";
import { useEffect, type ReactNode } from "react";
import type { LatLngExpression } from "leaflet";
import type { LatLon } from "../../utils/geo";

interface DroneMapProps {
  center: LatLon | null;
  zoom: number;
  className?: string;
  showScale?: boolean;
  children?: ReactNode;
}

function DroneView({ center, zoom }: { center: LatLon; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lon], zoom);
  }, [map, center.lat, center.lon, zoom]);

  useEffect(() => {
    const node = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(node);
    return () => observer.disconnect();
  }, [map]);

  return null;
}

export function DroneMap({ center, zoom, className, showScale = false, children }: DroneMapProps) {
  const containerClass = className ? `map-container ${className}` : "map-container";
  if (!center) {
    return <div className={containerClass}>Belum ada posisi GPS</div>;
  }
  return (
    <MapContainer center={[center.lat, center.lon] as LatLngExpression} zoom={zoom} className={containerClass} scrollWheelZoom>
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <DroneView center={center} zoom={zoom} />
      {showScale ? <ScaleControl position="bottomleft" imperial={false} /> : null}
      {children}
    </MapContainer>
  );
}
