import { fmtNumber } from "../../utils/format";

interface VoltageCurrentCardProps {
  voltage: number | null;
  current: number | null;
  avgCurrent: number | null;
}

export function VoltageCurrentCard({ voltage, current, avgCurrent }: VoltageCurrentCardProps) {
  return (
    <div className="card card-pad">
      <div className="section-title">Tegangan &amp; Arus</div>
      <div className="grid grid-2" style={{ gap: "var(--space-3)" }}>
        <div className="metric">
          <span className="metric-label">Tegangan</span>
          <span className="metric-value small">{fmtNumber(voltage, 2)} V</span>
        </div>
        <div className="metric">
          <span className="metric-label">Arus</span>
          <span className="metric-value small">{fmtNumber(current)} A</span>
        </div>
        <div className="metric">
          <span className="metric-label">Rata-rata</span>
          <span className="metric-value small">{fmtNumber(avgCurrent)} A</span>
        </div>
      </div>
    </div>
  );
}
