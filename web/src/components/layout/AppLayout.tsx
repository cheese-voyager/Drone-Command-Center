import { useState } from "react";
import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppLayout({ children }: { children?: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
