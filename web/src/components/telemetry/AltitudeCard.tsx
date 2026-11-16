import { fmtNumber } from "../../utils/format";

interface AltitudeCardProps {
  alt: number | null;
  speed: number | null;
  avgSpeed: number | null;
}

export function AltitudeCard({ alt, speed, avgSpeed }: AltitudeCardProps) {
  return (
    <div className="card card-pad">
      <div className="section-title">Ketinggian &amp; Kecepatan</div>
      <div className="grid grid-2" style={{ gap: "var(--space-3)" }}>
        <div className="metric">
          <span className="metric-label">Ketinggian</span>
          <span className="metric-value small">{fmtNumber(alt)} m</span>
        </div>
        <div className="metric">
          <span className="metric-label">Kecepatan</span>
          <span className="metric-value small">{fmtNumber(speed)} m/s</span>
        </div>
        <div className="metric">
          <span className="metric-label">Rata-rata</span>
          <span className="metric-value small">{fmtNumber(avgSpeed)} m/s</span>
        </div>
      </div>
    </div>
  );
}
