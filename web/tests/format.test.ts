import { describe, expect, it } from "vitest";
import { fmtClock, fmtCoord, fmtDateTime, fmtDuration, fmtInt, fmtMinutes, fmtNumber, fmtPercent, toCsv } from "../src/utils/format";
import type { DropRecord } from "../src/types/drop";

describe("format", () => {
  it("fmtInt", () => {
    expect(fmtInt(12.4)).toBe("12");
    expect(fmtInt(null)).toBe("-");
  });

  it("fmtNumber", () => {
    expect(fmtNumber(3.14)).toBe("3.1");
    expect(fmtNumber(null)).toBe("-");
  });

  it("fmtPercent", () => {
    expect(fmtPercent(50)).toBe("50.0%");
    expect(fmtPercent(null)).toBe("-");
  });

  it("fmtCoord", () => {
    expect(fmtCoord(-6.2, 106.8)).toBe("-6.200000, 106.800000");
    expect(fmtCoord(null, 1)).toBe("-");
  });

  it("fmtDuration", () => {
    expect(fmtDuration(2.5)).toBe("2.5 s");
    expect(fmtDuration(90)).toBe("1 m 30.0 s");
    expect(fmtDuration(null)).toBe("-");
  });

  it("fmtClock dan fmtDateTime", () => {
    expect(fmtClock(0)).toBe("07:00:00");
    expect(fmtDateTime(0)).toBe("1970-01-01 07:00:00");
  });

  it("fmtMinutes", () => {
    expect(fmtMinutes(45)).toBe("45 mnt");
    expect(fmtMinutes(90)).toBe("1 jam 30 mnt");
    expect(fmtMinutes(null)).toBe("-");
  });

  it("toCsv", () => {
    const drops: DropRecord[] = [{ time: 123, lat: -6.2, lon: 106.8, thrust: 70, duration: 1.5 }];
    expect(toCsv(drops)).toContain("waktu,lat,lon,thrust,durasi");
  });
});
