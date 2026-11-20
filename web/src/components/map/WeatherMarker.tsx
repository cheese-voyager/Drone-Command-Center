import { CircleMarker, Tooltip } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import type { BmkgLocation } from "../../api/bmkg";

interface WeatherMarkerProps {
  place: BmkgLocation | null;
}

export function WeatherMarker({ place }: WeatherMarkerProps) {
  if (!place || !Number.isFinite(place.lat) || !Number.isFinite(place.lon)) {
    return null;
  }
  return (
    <CircleMarker
      center={[place.lat, place.lon] as LatLngExpression}
      radius={9}
      pathOptions={{ color: "#ffb020", weight: 2, fillColor: "#ffb020", fillOpacity: 0.18 }}
    >
      <Tooltip direction="top" offset={[0, -8]}>
        Titik prakiraan BMKG · {place.desa}, {place.kecamatan}
      </Tooltip>
    </CircleMarker>
  );
}
