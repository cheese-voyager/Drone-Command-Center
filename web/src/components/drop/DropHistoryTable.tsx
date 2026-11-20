import { exportDropsExcel, exportDropsPdf } from "../../utils/reports";
import type { DropRecord } from "../../types";

interface DropHistoryTableProps {
  drops: DropRecord[];
}

export function DropHistoryTable({ drops }: DropHistoryTableProps) {
  if (drops.length === 0) {
    return <div className="empty">Belum ada drop.</div>;
  }

  return (
    <div>
      <div className="flex between center gap-3" style={{ marginBottom: "var(--space-2)" }}>
        <span className="muted">{drops.length} titik drop tercatat</span>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={() => exportDropsPdf(drops)}>
            PDF
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => exportDropsExcel(drops)}>
            Excel
          </button>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Lat</th>
              <th>Lon</th>
              <th>Thrust</th>
              <th>Durasi</th>
            </tr>
          </thead>
          <tbody>
            {drops.map((drop) => (
              <tr key={drop.time}>
                <td className="num">{new Date(drop.time * 1000).toLocaleTimeString("id-ID", { hour12: false })}</td>
                <td className="num">{drop.lat === null ? "-" : drop.lat.toFixed(6)}</td>
                <td className="num">{drop.lon === null ? "-" : drop.lon.toFixed(6)}</td>
                <td className="num">{drop.thrust}</td>
                <td className="num">{drop.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
