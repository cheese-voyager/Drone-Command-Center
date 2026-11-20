import { CircleMarker, Tooltip } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import type { LatLon } from "../../utils/geo";

interface SiteMarkerProps {
  site: LatLon;
  label: string;
}

export function SiteMarker({ site, label }: SiteMarkerProps) {
  return (
    <CircleMarker
      center={[site.lat, site.lon] as LatLngExpression}
      radius={8}
      pathOptions={{ color: "#2de2e6", weight: 2, fillColor: "#2de2e6", fillOpacity: 0.24 }}
    >
      <Tooltip direction="top" offset={[0, -8]}>
        {label} - {site.lat.toFixed(6)}, {site.lon.toFixed(6)}
      </Tooltip>
    </CircleMarker>
  );
}
