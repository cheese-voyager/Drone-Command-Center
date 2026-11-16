import { GPS_FIX_NAMES } from "../../utils/constants";
import { fmtCoord } from "../../utils/format";

interface GpsStatusCardProps {
  gpsFix: number | null;
  satellites: number | null;
  lat: number | null;
  lon: number | null;
}

export function GpsStatusCard({ gpsFix, satellites, lat, lon }: GpsStatusCardProps) {
  const fixLabel = gpsFix === null ? "-" : GPS_FIX_NAMES[gpsFix] ?? "-";
  const satelliteLabel = satellites === null ? "-" : String(Math.round(satellites));

  return (
    <div className="card card-pad">
      <div className="section-title">Posisi GPS</div>
      <dl className="kv">
        <dt>Fix</dt>
        <dd>{fixLabel}</dd>
        <dt>Satelit</dt>
        <dd>{satelliteLabel}</dd>
        <dt>Koordinat</dt>
        <dd>{fmtCoord(lat, lon)}</dd>
      </dl>
    </div>
  );
}
