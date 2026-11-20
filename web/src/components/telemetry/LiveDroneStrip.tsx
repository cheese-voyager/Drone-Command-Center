import { useDroneStore } from "../../store/droneStore";
import { GPS_FIX_NAMES } from "../../utils/constants";
import { fmtInt, fmtNumber } from "../../utils/format";

export function LiveDroneStrip() {
  const status = useDroneStore((state) => state.status);
  const backendOnline = useDroneStore((state) => state.backendOnline);
  const stale = useDroneStore((state) => state.stale);
  const battery = status?.battery?.remaining_percent ?? null;
  const fix = status?.gps_fix == null ? "-" : GPS_FIX_NAMES[status.gps_fix] ?? "-";
  const link = !backendOnline || stale ? "data basi" : status?.connected ? "Pixhawk OK" : "menunggu";
  const batteryTone = battery === null ? undefined : battery < 25 ? "error" : battery < 50 ? "warn" : undefined;

  return (
    <div className="mini-strip">
      <div className="stat" data-tone={status?.armed ? "warn" : undefined}>
        <div className="stat-head">
          <span className="metric-label">Mode</span>
        </div>
        <div className="stat-value">
          <b>{status?.mode ?? "-"}</b>
          <span>{status?.armed ? "ARMED" : "DISARMED"}</span>
        </div>
        <span className="metric-sub">{link}</span>
      </div>
      <div className="stat">
        <div className="stat-head">
          <span className="metric-label">Ketinggian</span>
        </div>
        <div className="stat-value">
          <b>{fmtNumber(status?.alt ?? null)}</b>
          <span>m</span>
        </div>
        <span className="metric-sub">Kecepatan {fmtNumber(status?.speed ?? null)} m/s</span>
      </div>
      <div className="stat">
        <div className="stat-head">
          <span className="metric-label">GPS</span>
        </div>
        <div className="stat-value">
          <b>{fix}</b>
        </div>
        <span className="metric-sub">{fmtInt(status?.satellites ?? null)} satelit</span>
      </div>
      <div className="stat" data-tone={batteryTone}>
        <div className="stat-head">
          <span className="metric-label">Baterai</span>
        </div>
        <div className="stat-value">
          <b>{fmtNumber(battery, 0)}</b>
          <span>%</span>
        </div>
        <span className="metric-sub">{fmtNumber(status?.voltage ?? null, 1)} V · {fmtNumber(status?.current ?? null)} A</span>
      </div>
      <div className="stat">
        <div className="stat-head">
          <span className="metric-label">Benih</span>
        </div>
        <div className="stat-value">
          <b>{fmtInt(status?.seed?.remaining ?? null)}</b>
          <span>sisa</span>
        </div>
        <span className="metric-sub">{fmtInt(status?.seed?.dropped ?? null)} sudah di-drop</span>
      </div>
    </div>
  );
}
