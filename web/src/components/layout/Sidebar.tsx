import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { useDroneStore } from "../../store/droneStore";

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

function IconDashboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

function IconMap() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}

function IconDrop() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v20M5 6c0-3 7-3 7 0s7 3 7 0c0-6-7-10-7-10s-7 4-7 10z" />
    </svg>
  );
}

function IconThruster() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

function IconBattery() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="18" height="12" rx="2" />
      <path d="M22 10h2a2 2 0 0 1 0 4h-2" />
      <path d="M6 12v.01" />
    </svg>
  );
}

function IconSeed() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18M3 12h18" />
    </svg>
  );
}

function IconHistory() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function IconVideo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="6" width="13" height="12" rx="2" />
      <path d="m15 10 6-3v10l-6-3" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.8 4.9 17 7M7 17l-2.1 2.1" />
    </svg>
  );
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const backendOnline = useDroneStore((state) => state.backendOnline);

  const items: NavItem[] = [
    { to: "/", label: "Dashboard", icon: <IconDashboard /> },
    { to: "/map", label: "Peta", icon: <IconMap /> },
    { to: "/drop", label: "Drop", icon: <IconDrop /> },
    { to: "/thruster", label: "Tes Thruster", icon: <IconThruster /> },
    { to: "/battery", label: "Baterai", icon: <IconBattery /> },
    { to: "/seed", label: "Benih", icon: <IconSeed /> },
    { to: "/history", label: "Riwayat Drop", icon: <IconHistory /> },
    { to: "/video", label: "Kamera", icon: <IconVideo /> },
    { to: "/settings", label: "Pengaturan", icon: <IconSettings /> },
  ];

  return (
    <aside className={`app-sidebar ${open ? "open" : ""}`}>
      <div className="brand">
        <span className="brand-mark">D</span>
        <span>Drone Command Center</span>
      </div>
      <nav className="nav">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            onClick={onClose}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span>Broker MQTT</span>
        <span className={backendOnline ? "badge badge-ok" : "badge badge-error"}>{backendOnline ? "online" : "offline"}</span>
      </div>
    </aside>
  );
}
