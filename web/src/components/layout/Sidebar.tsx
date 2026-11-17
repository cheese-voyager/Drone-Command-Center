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
      <path d="M12 3c3.5 4.2 6 7.2 6 10.2A6 6 0 0 1 6 13.2C6 10.2 8.5 7.2 12 3z" />
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
      <path d="M12 21v-9" />
      <path d="M12 12c0-4 3-7 8-7 0 4-3 7-8 7z" />
      <path d="M12 14c0-3-2-5-6-5 0 3 2 5 6 5z" />
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
  const pixhawk = useDroneStore((state) => state.status?.connected ?? false);
  const stale = useDroneStore((state) => state.stale);

  const operations: NavItem[] = [
    { to: "/", label: "Dashboard", icon: <IconDashboard /> },
    { to: "/map", label: "Peta", icon: <IconMap /> },
    { to: "/drop", label: "Drop Benih", icon: <IconDrop /> },
    { to: "/thruster", label: "Tes Thruster", icon: <IconThruster /> },
  ];
  const system: NavItem[] = [
    { to: "/battery", label: "Baterai", icon: <IconBattery /> },
    { to: "/seed", label: "Benih", icon: <IconSeed /> },
    { to: "/history", label: "Riwayat Drop", icon: <IconHistory /> },
    { to: "/video", label: "Kamera", icon: <IconVideo /> },
    { to: "/settings", label: "Pengaturan", icon: <IconSettings /> },
  ];

  const renderItems = (items: NavItem[]) =>
    items.map((item) => (
      <NavLink key={item.to} to={item.to} end={item.to === "/"} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} onClick={onClose}>
        {item.icon}
        <span>{item.label}</span>
      </NavLink>
    ));

  return (
    <aside className={`app-sidebar ${open ? "open" : ""}`}>
      <nav className="nav" aria-label="Navigasi utama">
        <div className="nav-section">Operasi</div>
        {renderItems(operations)}
        <div className="nav-section">Sistem</div>
        {renderItems(system)}
      </nav>
      <div className="sidebar-footer">
        <span className="title">Tautan data</span>
        <div className="row">
          <span>Backend</span>
          <b>{backendOnline ? "online" : "offline"}</b>
        </div>
        <div className="row">
          <span>Pixhawk</span>
          <b>{pixhawk ? "terhubung" : "terputus"}</b>
        </div>
        <div className="row">
          <span>Telemetri</span>
          <b>{stale ? "basi" : "segar"}</b>
        </div>
      </div>
    </aside>
  );
}
