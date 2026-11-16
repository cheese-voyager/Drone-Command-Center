import { useEffect, useState } from "react";
import { ConnectionBadge } from "./ConnectionBadge";
import { EmergencyStopButton } from "../thruster/EmergencyStopButton";
import { useDroneStore } from "../../store/droneStore";

export function Topbar({ title, onMenuClick }: { title: string; onMenuClick: () => void }) {
  const status = useDroneStore((state) => state.status);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const time = now.toLocaleTimeString("id-ID", { hour12: false });

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="btn btn-ghost btn-sm sidebar-toggle" onClick={onMenuClick} aria-label="Buka menu">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="topbar-title">{title}</span>
      </div>
      <div className="topbar-right">
        <span className="mono nowrap">{time}</span>
        <span className={`badge ${status?.armed ? "badge-error" : "badge-ok"}`}>{status?.armed ? "ARMED" : "DISARMED"}</span>
        <ConnectionBadge />
        <EmergencyStopButton />
      </div>
    </header>
  );
}
