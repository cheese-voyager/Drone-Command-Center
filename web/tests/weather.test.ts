import { describe, expect, it } from "vitest";
import type { BmkgSlot } from "../src/api/bmkg";
import {
  assessSlot,
  compassFromDeg,
  fmtAnalysis,
  fmtSlotClock,
  fmtSlotDay,
  pickCurrentSlot,
  upcomingSlots,
  windText,
} from "../src/utils/weather";

function slot(overrides: Partial<BmkgSlot> = {}): BmkgSlot {
  return {
    datetime: "2026-11-18T12:00:00Z",
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
    utc_datetime: "2026-11-18 12:00:00",
    local_datetime: "2026-11-18 19:00:00",
    ...overrides,
  };
}

const at = (iso: string) => Date.parse(iso);

describe("utils/weather", () => {
  it("memilih slot berjalan dan fallback dengan benar", () => {
    const slots = [
      slot({ datetime: "2026-11-18T12:00:00Z" }),
      slot({ datetime: "2026-11-18T15:00:00Z" }),
      slot({ datetime: "2026-11-18T18:00:00Z" }),
    ];
    expect(pickCurrentSlot(slots, at("2026-11-18T16:00:00Z"))).toBe(slots[1]);
    expect(pickCurrentSlot(slots, at("2026-11-18T10:00:00Z"))).toBe(slots[0]);
    expect(pickCurrentSlot(slots, at("2026-11-19T00:00:00Z"))).toBe(slots[2]);
    expect(pickCurrentSlot([], Date.now())).toBeNull();
  });

  it("mengambil slot berikutnya", () => {
    const slots = [
      slot({ datetime: "2026-11-18T12:00:00Z" }),
      slot({ datetime: "2026-11-18T15:00:00Z" }),
      slot({ datetime: "2026-11-18T18:00:00Z" }),
    ];
    const next = upcomingSlots(slots, 2, at("2026-11-18T16:00:00Z"));
    expect(next.map((s) => s.datetime)).toEqual(["2026-11-18T18:00:00Z"]);
  });

  it("memformat jam, tanggal, rilis, dan arah", () => {
    const s = slot({ local_datetime: "2026-11-18 21:05:00" });
    expect(fmtSlotClock(s)).toBe("21:05");
    expect(fmtSlotDay(s)).toBe("18/11");
    expect(fmtSlotClock(null)).toBe("--:--");
    expect(fmtAnalysis("2026-11-18T12:00:00")).toBe("18/11 19:00 WIB");
    expect(fmtAnalysis(null)).toBe("-");
    expect(compassFromDeg(190)).toBe("S");
    expect(compassFromDeg(90)).toBe("T");
    expect(compassFromDeg(0)).toBe("U");
    expect(compassFromDeg(359)).toBe("U");
    expect(compassFromDeg(null)).toBeNull();
    expect(windText(s)).toBe("5 km/jam dari S");
  });

  it("menilai risiko terbang", () => {
    expect(assessSlot(slot()).level).toBe("ok");
    expect(assessSlot(slot({ ws: 22 })).level).toBe("warn");
    expect(assessSlot(slot({ ws: 35 })).level).toBe("bad");
    expect(assessSlot(slot({ tp: 1.5 })).level).toBe("warn");
    expect(assessSlot(slot({ tp: 3 })).level).toBe("bad");
    expect(assessSlot(slot({ weather: 95 })).level).toBe("bad");
    expect(assessSlot(slot({ vs: 1500 })).level).toBe("bad");
    expect(assessSlot(slot({ vs: 4000 })).level).toBe("warn");
    expect(assessSlot(null).level).toBe("ok");
  });
});
