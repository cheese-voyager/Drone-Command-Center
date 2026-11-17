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
      <Topbar onMenuClick={() => setSidebarOpen((open) => !open)} />
      <div className="app-body">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="app-content app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
