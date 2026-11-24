import { useDroneStore } from "../../store/droneStore";

type Tone = "ok" | "warn" | "error" | "primary";

export function ConnectionStatus() {
  const error = useDroneStore((state) => state.error);
  const connecting = useDroneStore((state) => state.connecting);
  const backendOnline = useDroneStore((state) => state.backendOnline);
  const stale = useDroneStore((state) => state.stale);
  const hasStatus = useDroneStore((state) => state.status !== null);

  let label = "LIVE";
  let tone: Tone = "ok";

  if (error) {
    label = "ERROR";
    tone = "error";
  } else if (connecting && !hasStatus) {
    label = "CONNECTING";
    tone = "primary";
  } else if (!backendOnline) {
    label = "OFFLINE";
    tone = "error";
  } else if (stale || !hasStatus) {
    label = "STALE";
    tone = "warn";
  }

  return (
    <span className={`badge badge-${tone}`} data-testid="connection-status">
      <i className={`status-dot ${tone === "ok" ? "ok" : tone === "primary" ? "" : tone}`} />
      {label}
    </span>
  );
}
