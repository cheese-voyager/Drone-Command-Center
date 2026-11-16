import { describe, expect, it } from "vitest";
import { bearingDeg, distanceKm, isValidCoord, mapBounds } from "../src/utils/geo";

describe("geo", () => {
  it("isValidCoord", () => {
    expect(isValidCoord(0, 0)).toBe(true);
    expect(isValidCoord(91, 0)).toBe(false);
  });

  it("distanceKm", () => {
    expect(distanceKm(0, 0, 0, 1)).toBeGreaterThan(0);
  });

  it("bearingDeg", () => {
    expect(bearingDeg(0, 0, 0, 1)).toBeGreaterThan(0);
  });

  it("mapBounds", () => {
    expect(mapBounds([{ lat: 0, lon: 0 }, { lat: 1, lon: 1 }])).toEqual({ west: 0, south: 0, east: 1, north: 1 });
    expect(mapBounds([])).toBeNull();
  });
});
