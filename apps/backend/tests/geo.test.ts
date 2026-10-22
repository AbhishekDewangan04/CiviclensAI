import { describe, expect, it } from "vitest";
import { haversineMeters, withinBbox } from "../src/services/geo";

function expectWithinPercent(actual: number, expected: number, percent: number): void {
  expect(Math.abs(actual - expected) / expected).toBeLessThan(percent / 100);
}

describe("haversineMeters", () => {
  it("is zero for identical points", () => {
    expect(haversineMeters(21.25, 81.63, 21.25, 81.63)).toBe(0);
  });

  it("measures one degree of longitude on the equator (about 111.195 km)", () => {
    expectWithinPercent(haversineMeters(0, 0, 0, 1), 111_195, 1);
  });

  it("measures London to Paris (about 343.5 km)", () => {
    expectWithinPercent(haversineMeters(51.5074, -0.1278, 48.8566, 2.3522), 343_500, 1);
  });

  it("is symmetric", () => {
    const forward = haversineMeters(21.25, 81.63, 28.61, 77.21);
    const backward = haversineMeters(28.61, 77.21, 21.25, 81.63);
    expect(forward).toBeCloseTo(backward, 6);
  });
});

describe("withinBbox", () => {
  const bbox = { minLng: 81.6, minLat: 21.2, maxLng: 81.7, maxLat: 21.3 };

  it("includes interior and edge points and excludes outside points", () => {
    expect(withinBbox(21.25, 81.65, bbox)).toBe(true);
    expect(withinBbox(21.2, 81.6, bbox)).toBe(true);
    expect(withinBbox(21.3, 81.7, bbox)).toBe(true);
    expect(withinBbox(21.31, 81.65, bbox)).toBe(false);
    expect(withinBbox(21.25, 81.59, bbox)).toBe(false);
  });
});