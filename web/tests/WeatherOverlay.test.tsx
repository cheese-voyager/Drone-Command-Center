import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WeatherOverlay } from "../src/components/weather/WeatherOverlay";
import type { BmkgSlot } from "../src/api/bmkg";
import type { WeatherState } from "../src/hooks/useWeather";

const location = {
  adm1: "32",
  adm2: "32.73",
  adm3: "32.73.19",
  adm4: "32.73.19.1003",
  provinsi: "Jawa Barat",
  kotkab: "Kota Bandung",
  kecamatan: "Sumur Bandung",
  desa: "Kebon Pisang",
  lat: -6.9192887566,
  lon: 107.617101245,
};

const slot: BmkgSlot = {
  datetime: "2026-11-18T14:00:00Z",
  t: 26,
  tcc: 90,
  tp: 0,
  weather: 3,
  weather_desc: "Berawan",
  weather_desc_en: "Mostly Cloudy",
  wd_deg: 203,
  wd: "S",
  wd_to: "N",
  ws: 5,
  hu: 91,
  vs: 20000,
  vs_text: "> 10 km",
  time_index: "0-1",
  analysis_date: "2026-11-18T12:00:00",
  image: null,
  utc_datetime: "2026-11-18 14:00:00",
  local_datetime: "2026-11-18 21:00:00",
};

function makeState(overrides: Partial<WeatherState> = {}): WeatherState {
  return {
    status: "ready",
    location,
    slots: [slot],
    error: null,
    updatedAt: Date.now(),
    reload: vi.fn(),
    ...overrides,
  };
}

describe("WeatherOverlay", () => {
  it("menampilkan ringkasan cuaca dan sumber BMKG", () => {
    render(<WeatherOverlay weather={makeState()} lat={-6.917} lon={107.618} />);
    expect(screen.getByText("Kebon Pisang, Sumur Bandung")).toBeInTheDocument();
    expect(screen.getByText("26°")).toBeInTheDocument();
    expect(screen.getByText("Berawan")).toBeInTheDocument();
    expect(screen.getByText(/5 km\/jam dari S/)).toBeInTheDocument();
    expect(screen.getByText(/Sumber: BMKG/)).toBeInTheDocument();
  });

  it("menampilkan status menunggu GPS", () => {
    render(<WeatherOverlay weather={makeState()} lat={null} lon={null} />);
    expect(screen.getByText(/Menunggu posisi GPS/)).toBeInTheDocument();
  });
});
