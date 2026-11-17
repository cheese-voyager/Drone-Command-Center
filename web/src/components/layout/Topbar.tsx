import { useEffect, useState } from "react";
import { ConnectionBadge } from "./ConnectionBadge";
import { EmergencyStopButton } from "../thruster/EmergencyStopButton";
import { useDroneStore } from "../../store/droneStore";

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const status = useDroneStore((state) => state.status);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const time = now.toLocaleTimeString("id-ID", { hour12: false });
  const date = now.toLocaleDateString("id-ID", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="btn btn-ghost btn-sm sidebar-toggle" onClick={onMenuClick} aria-label="Buka menu">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="8" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          </span>
          <div>
            <div className="brand-name">Drone Command Center</div>
            <div className="brand-sub">Ground station</div>
          </div>
        </div>
      </div>
      <div className="topbar-clock" aria-label="Waktu lokal">
        <div className="time">{time}</div>
        <div className="date">{date}</div>
      </div>
      <div className="topbar-right">
        <ConnectionBadge />
        <span className={`badge ${status?.armed ? "badge-error" : "badge-primary"}`}>{status?.armed ? "ARMED" : "DISARMED"}</span>
        <EmergencyStopButton />
      </div>
    </header>
  );
}
