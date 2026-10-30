import { describe, expect, it } from "vitest";
import { EdgeScroll } from "../src/lib/autoscroll.ts";

const M = EdgeScroll.MARGIN;
const S = EdgeScroll.MAX_STEP;

describe("EdgeScroll.step", () => {
  it("is zero in the middle of the box and outside it", () => {
    expect(EdgeScroll.step(500, 100, 900, M, S)).toBe(0);
    expect(EdgeScroll.step(148, 100, 900, M, S)).toBe(0);   // exactly at the inner side of the top band
    expect(EdgeScroll.step(852, 100, 900, M, S)).toBe(0);   // exactly at the inner side of the bottom band
    expect(EdgeScroll.step(99, 100, 900, M, S)).toBe(0);    // over the header above the box
    expect(EdgeScroll.step(901, 100, 900, M, S)).toBe(0);
    expect(EdgeScroll.step(500, 900, 100, M, S)).toBe(0);   // an inverted box
    expect(EdgeScroll.step(100, 100, 100, M, S)).toBe(0);   // an empty box
  });

  it("scrolls up near the top, faster at the edge", () => {
    expect(EdgeScroll.step(100, 100, 900, M, S)).toBe(-14);
    expect(EdgeScroll.step(124, 100, 900, M, S)).toBe(-7);
    expect(EdgeScroll.step(147, 100, 900, M, S)).toBe(-1);  // never rounds to a dead zero inside the band
  });

  it("scrolls down near the bottom, faster at the edge", () => {
    expect(EdgeScroll.step(900, 100, 900, M, S)).toBe(14);
    expect(EdgeScroll.step(876, 100, 900, M, S)).toBe(7);
    expect(EdgeScroll.step(853, 100, 900, M, S)).toBe(1);
  });

  it("takes the margin and the step from the caller", () => {
    expect(EdgeScroll.step(110, 100, 900, 20, 40)).toBe(-20);
    expect(EdgeScroll.step(890, 100, 900, 20, 40)).toBe(20);
    expect(EdgeScroll.step(130, 100, 900, 20, 40)).toBe(0);
  });

  it("halves the band for a box shorter than two margins", () => {
    expect(EdgeScroll.step(110, 100, 140, M, S)).toBe(-7);  // band 20: halfway into the top band
    expect(EdgeScroll.step(120, 100, 140, M, S)).toBe(0);   // the middle line belongs to neither band
    expect(EdgeScroll.step(130, 100, 140, M, S)).toBe(7);
  });
});
