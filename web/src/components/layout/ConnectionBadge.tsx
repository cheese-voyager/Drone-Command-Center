import { useDroneStore } from "../../store/droneStore";

export function ConnectionBadge() {
  const backendOnline = useDroneStore((state) => state.backendOnline);
  const status = useDroneStore((state) => state.status);

  const backend = backendOnline;
  const pixhawk = status?.connected ?? false;

  return (
    <div className="status-group">
      <span className="status-pill">
        <span className={`status-dot ${backend ? "ok" : "error"}`} />
        Backend <strong>{backend ? "online" : "offline"}</strong>
      </span>
      <span className="status-pill">
        <span className={`status-dot ${pixhawk ? "ok" : "error"}`} />
        Pixhawk <strong>{pixhawk ? "terhubung" : "tidak terhubung"}</strong>
      </span>
    </div>
  );
}
