import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useDroneStatus } from "../../hooks/useDroneStatus";

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useDroneStatus();

  return (
    <div className="app-shell">
      {sidebarOpen ? (
        <div
          className="modal-overlay"
          style={{ background: "rgba(2,6,16,0.65)", pointerEvents: "auto" }}
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="app-main">
        <Topbar title="Drone Command Center" onMenuClick={() => setSidebarOpen(true)} />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
