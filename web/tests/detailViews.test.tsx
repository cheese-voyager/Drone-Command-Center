import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BatteryDetailPage } from "../src/pages/detail/BatteryDetail";
import { DropDetailPage } from "../src/pages/detail/DropDetail";
import { MapDetailPage } from "../src/pages/detail/MapDetail";
import { SeedDetailPage } from "../src/pages/detail/SeedDetail";
import { StatusDetailPage } from "../src/pages/detail/StatusDetail";
import { ThrusterDetailPage } from "../src/pages/detail/ThrusterDetail";
import { VideoDetailPage } from "../src/pages/detail/VideoDetail";
import { useDroneStore } from "../src/store/droneStore";
import type { DroneStatus, TelemetrySample } from "../src/types";

vi.mock("../src/components/map/DroneMap", () => ({
  DroneMap: ({ children }: { children?: ReactNode }) => <div data-testid="drone-map">{children}</div>,
}));
vi.mock("../src/components/map/DroneMarker", () => ({ DroneMarker: () => null }));
vi.mock("../src/components/map/SiteMarker", () => ({ SiteMarker: () => null }));
vi.mock("../src/components/map/FlightPath", () => ({ FlightPath: () => null }));
vi.mock("../src/components/map/DropMarkers", () => ({ DropMarkers: () => null }));
vi.mock("../src/components/map/WeatherMarker", () => ({ WeatherMarker: () => null }));
vi.mock("../src/components/weather/WeatherOverlay", () => ({ WeatherOverlay: () => null }));
vi.mock("../src/hooks/useWeather", () => ({
  useWeather: () => ({
    status: "idle",
    location: null,
    slots: [],
    error: null,
    updatedAt: null,
    reload: () => undefined,
  }),
}));

const status: DroneStatus = {
  connected: true,
  mode: "LOITER",
  armed: false,
  lat: -6.9,
  lon: 107.6,
  alt: 12,
  pitch: 1,
  roll: 2,
  yaw: 90,
  speed: 3,
  voltage: 16.4,
  current: 2.1,
  gps_fix: 3,
  satellites: 12,
  motors: [{ id: 1, pwm: 1200, percent: 30 }],
  battery: {
    capacity_mah: 5000,
    used_mah: 1000,
    remaining_mah: 4000,
    remaining_percent: 80,
    avg_current: 2,
    estimated_minutes_left: 20,
    low: false,
  },
  seed: { loaded: 100, dropped: 10, remaining: 90 },
  avg_speed: 2.5,
};

beforeEach(() => {
  useDroneStore.setState({
    client: null,
    status,
    history: [],
    drops: [],
    backendOnline: true,
    stale: false,
    lastDrop: null,
    error: null,
    connecting: false,
    lastStatusAt: Date.now(),
  });
});

describe("halaman detail fitur", () => {
  it("status menampilkan data perangkat, navigasi, dan payload mentah", () => {
    render(<StatusDetailPage />);
    expect(screen.getByText("Status perangkat")).toBeInTheDocument();
    expect(screen.getByText("Posisi dan navigasi")).toBeInTheDocument();
    expect(screen.getByText("Payload status mentah")).toBeInTheDocument();
    expect(screen.getByText("LOITER")).toBeInTheDocument();
  });

  it("baterai menampilkan kapasitas dan riwayat daya", () => {
    render(<BatteryDetailPage />);
    expect(screen.getByText("Baterai saat ini")).toBeInTheDocument();
    expect(screen.getByText("Riwayat daya")).toBeInTheDocument();
    expect(screen.getAllByText("5000").length).toBeGreaterThan(0);
  });

  it("benih menampilkan sisa dan riwayat benih", () => {
    render(<SeedDetailPage />);
    expect(screen.getByText("Benih saat ini")).toBeInTheDocument();
    expect(screen.getByText("Riwayat benih")).toBeInTheDocument();
    expect(screen.getByText("90")).toBeInTheDocument();
  });

  it("thruster menampilkan status pengaman dan output motor", () => {
    render(<ThrusterDetailPage />);
    expect(screen.getByText("Status pengaman")).toBeInTheDocument();
    expect(screen.getByText("Output motor")).toBeInTheDocument();
    expect(screen.getByText("M1")).toBeInTheDocument();
  });

  it("drop menampilkan kondisi dan konfigurasi drop", () => {
    render(<DropDetailPage />);
    expect(screen.getByText("Kondisi drop")).toBeInTheDocument();
    expect(screen.getByText("Konfigurasi drop aktif")).toBeInTheDocument();
    expect(screen.queryByText("Drop event terakhir")).not.toBeInTheDocument();
  });

  it("video menampilkan pratinjau langsung dan metadata kamera", () => {
    render(<VideoDetailPage />);
    expect(screen.getByText("Pratinjau langsung")).toBeInTheDocument();
    expect(screen.getByText("Metadata kamera")).toBeInTheDocument();
    expect(screen.getByAltText("Pratinjau kamera")).toBeInTheDocument();
  });

  it("peta memuat satu peta dan riwayat koordinat", () => {
    const sample: TelemetrySample = {
      time: Date.now(),
      lat: -6.9,
      lon: 107.6,
      alt: 12,
      speed: 2,
      yaw: 90,
      voltage: 16.4,
      current: 2.1,
      battery: 80,
      satellites: 12,
      gps_fix: 3,
      mode: "LOITER",
      armed: false,
      motors: null,
      seed_remaining: 90,
    };
    useDroneStore.setState({ history: [sample] });

    render(<MapDetailPage />);
    expect(screen.getAllByTestId("drone-map")).toHaveLength(1);
    expect(screen.queryByText("Gambaran peta")).not.toBeInTheDocument();
    expect(screen.getByText("Ringkasan rute")).toBeInTheDocument();
    expect(screen.getByText("Posisi drone")).toBeInTheDocument();
    expect(screen.getByText("Semua sampel rute")).toBeInTheDocument();
    expect(screen.getAllByText("-6.900000, 107.600000").length).toBeGreaterThan(0);
  });
});
