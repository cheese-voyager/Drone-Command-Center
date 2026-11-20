import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { clearBmkgCache } from "../src/api/bmkg";
import { useWeather } from "../src/hooks/useWeather";

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

const slot = {
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

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearBmkgCache();
});

describe("useWeather", () => {
  it("idle saat koordinat belum tersedia", () => {
    const { result } = renderHook(() => useWeather(null, null));
    expect(result.current.status).toBe("idle");
    expect(result.current.slots).toHaveLength(0);
  });

  it("resolve adm4 lalu memuat prakiraan", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/adm/coord")) {
        return jsonResponse(location);
      }
      return jsonResponse({ data: [{ lokasi: location, cuaca: [[slot]] }] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useWeather(-6.917, 107.618));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.location?.adm4).toBe("32.73.19.1003");
    expect(result.current.slots).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("menampilkan error saat BMKG gagal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 500 })),
    );

    const { result } = renderHook(() => useWeather(-6.917, 107.618));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toContain("HTTP 500");
  });
});
