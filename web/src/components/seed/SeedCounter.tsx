import { Card } from "../ui/Card";
import { fmtInt } from "../../utils/format";
import { useDroneStore } from "../../store/droneStore";

export function SeedCounter() {
  const status = useDroneStore((state) => state.status);
  const seed = status?.seed;

  return (
    <Card title="Ringkasan benih">
      <div className="grid grid-3">
        <div className="metric">
          <span className="metric-label">Dimuat</span>
          <span className="metric-value small">{fmtInt(seed?.loaded)}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Sudah ditebar</span>
          <span className="metric-value small">{fmtInt(seed?.dropped)}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Sisa</span>
          <span className="metric-value small">{fmtInt(seed?.remaining)}</span>
        </div>
      </div>
    </Card>
  );
}
