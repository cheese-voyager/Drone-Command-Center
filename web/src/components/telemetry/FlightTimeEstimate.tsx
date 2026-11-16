import { fmtMinutes } from "../../utils/format";

interface FlightTimeEstimateProps {
  minutes: number | null;
}

export function FlightTimeEstimate({ minutes }: FlightTimeEstimateProps) {
  return (
    <div className="card card-pad">
      <div className="section-title">Estimasi Waktu Terbang</div>
      <div className="metric">
        <span className="metric-value small">{fmtMinutes(minutes)}</span>
        <span className="metric-sub">Berdasarkan arus rata-rata</span>
      </div>
    </div>
  );
}
