import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useDroneStatus } from "../../hooks/useDroneStatus";
import { useFlightLogRecorder } from "../../hooks/useFlightLogRecorder";

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useDroneStatus();
  useFlightLogRecorder();

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
