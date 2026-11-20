import { useEffect, useState } from "react";
import { ConnectionBadge } from "./ConnectionBadge";
import { EmergencyStopButton } from "../thruster/EmergencyStopButton";
import { useDroneStore } from "../../store/droneStore";
import { useSettingsStore } from "../../store/settingsStore";
import logo from "../../assets/icons/Logo.png";

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const status = useDroneStore((state) => state.status);
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const [now, setNow] = useState(() => new Date());
  const isDark = theme === "dark";

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
            <img className="brand-logo" src={logo} alt="" />
          </span>
          <div>
            <div className="brand-name">Astra Versa</div>
            <div className="brand-sub">Ground station</div>
          </div>
        </div>
      </div>
      <div className="topbar-clock" aria-label="Waktu lokal">
        <div className="time">{time}</div>
        <div className="date">{date}</div>
      </div>
      <div className="topbar-right">
        <button
          type="button"
          className="icon-btn"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label={isDark ? "Ganti ke tema terang" : "Ganti ke tema gelap"}
          title={isDark ? "Tema terang" : "Tema gelap"}
        >
          {isDark ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8z" />
            </svg>
          )}
        </button>
        <ConnectionBadge />
        <span className={`badge ${status?.armed ? "badge-error" : "badge-primary"}`}>{status?.armed ? "ARMED" : "DISARMED"}</span>
        <EmergencyStopButton />
      </div>
    </header>
  );
}
