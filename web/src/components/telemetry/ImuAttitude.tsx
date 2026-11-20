import { fmtNumber } from "../../utils/format";

interface ImuAttitudeProps {
  pitch: number | null;
  roll: number | null;
  yaw: number | null;
}

export function ImuAttitude({ pitch, roll, yaw }: ImuAttitudeProps) {
  return (
    <div className="card card-pad">
      <div className="section-title">Orientasi (IMU)</div>
      <div className="grid grid-3" style={{ gap: "var(--space-3)" }}>
        <div className="metric">
          <span className="metric-label">Pitch</span>
          <span className="metric-value small">{fmtNumber(pitch)}°</span>
        </div>
        <div className="metric">
          <span className="metric-label">Roll</span>
          <span className="metric-value small">{fmtNumber(roll)}°</span>
        </div>
        <div className="metric">
          <span className="metric-label">Yaw</span>
          <span className="metric-value small">{fmtNumber(yaw, 0)}°</span>
        </div>
      </div>
    </div>
  );
}
