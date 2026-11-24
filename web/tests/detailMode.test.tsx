import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { DetailLink } from "../src/components/detail/DetailLink";
import { MissionPlannerGroups } from "../src/components/detail/MissionPlannerGroups";
import { ConnectionStatus } from "../src/components/layout/ConnectionStatus";
import { DetailLayout } from "../src/components/layout/DetailLayout";
import { useDroneStore } from "../src/store/droneStore";
import type { DroneStatus } from "../src/types";

const status = {
  connected: true,
  armed: false,
  battery: { remaining_percent: 80 },
  seed: { remaining: 90 },
  time: { utc: "2026-01-01T00:00:00Z" },
  mission: {
    current_wp: 3,
    total_wp: 4,
    state: "AUTO",
    next_wp_lat: -6.9,
    next_wp_lon: 107.6,
    wp_distance_m: 120,
    target_bearing_deg: 90,
    nav_bearing_deg: 88,
  },
  gps: { fix_type: 6, satellites_visible: 14, rtk_status: "fixed", hdop: 0.8 },
  health: { prearm_ok: true, ekf_ok: true, failsafe: [] },
  link: { rssi: -65, noise: -95 },
  schema_version: 2,
} as unknown as DroneStatus;

beforeEach(() => {
  useDroneStore.setState({
    status: null,
    history: [],
    drops: [],
    backendOnline: false,
    stale: false,
    lastDrop: null,
    error: null,
    connecting: false,
    lastStatusAt: 0,
  });
});

describe("mode detail", () => {
  it("menyediakan tautan detail dengan label aksesibel", () => {
    render(
      <MemoryRouter>
        <DetailLink to="/detail/peta" label="Buka detail peta" />
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: "Buka detail peta" });
    expect(link).toHaveAttribute("href", "/detail/peta");
  });

  it("menampilkan status koneksi sesuai state store", () => {
    useDroneStore.setState({ connecting: true });
    const { rerender } = render(<ConnectionStatus />);
    expect(screen.getByTestId("connection-status")).toHaveTextContent("CONNECTING");

    useDroneStore.setState({ connecting: false, backendOnline: true, stale: true, status });
    rerender(<ConnectionStatus />);
    expect(screen.getByTestId("connection-status")).toHaveTextContent("STALE");

    useDroneStore.setState({ error: "MQTT mati" });
    rerender(<ConnectionStatus />);
    expect(screen.getByTestId("connection-status")).toHaveTextContent("ERROR");
  });

  it("menyajikan data Mission Planner yang sudah diolah", () => {
    useDroneStore.setState({ status });
    render(<MissionPlannerGroups />);

    expect(screen.getByText("Telemetri terolah")).toBeInTheDocument();
    expect(screen.getByText("Status misi")).toBeInTheDocument();
    expect(screen.getByText("3 / 4")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("RTK fixed")).toBeInTheDocument();
    expect(screen.getAllByText("Sistem sehat").length).toBeGreaterThan(0);
    expect(screen.getByText(/"current_wp": 3/)).toBeInTheDocument();
  });

  it("menampilkan shell detail tanpa navigasi utama", () => {
    useDroneStore.setState({ status, backendOnline: true });
    render(
      <MemoryRouter initialEntries={["/detail/baterai"]}>
        <Routes>
          <Route path="/detail" element={<DetailLayout />}>
            <Route path="baterai" element={<div>Halaman baterai</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Astra Versa")).toBeInTheDocument();
    expect(screen.getByText("LIVE")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Baterai dan daya" })).toBeInTheDocument();
    expect(screen.getByText("Kesehatan armada")).toBeInTheDocument();
    expect(screen.getByText("Kapasitas, tegangan, arus, dan estimasi waktu operasi tersisa.")).toBeInTheDocument();
    expect(screen.getByText("Halaman baterai")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Kembali ke Baterai" })).toHaveAttribute("href", "/baterai");
    expect(screen.getByRole("link", { name: "Detail status" })).toHaveAttribute("href", "/detail/status");
  });
});
