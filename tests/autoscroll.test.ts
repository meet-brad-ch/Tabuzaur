import { describe, expect, it } from "vitest";
import { edgeScrollStep } from "../src/lib/autoscroll.ts";

describe("edgeScrollStep", () => {
  it("is zero in the middle of the box and outside it", () => {
    expect(edgeScrollStep(500, 100, 900)).toBe(0);
    expect(edgeScrollStep(148, 100, 900)).toBe(0);   // exactly at the inner side of the top band
    expect(edgeScrollStep(852, 100, 900)).toBe(0);   // exactly at the inner side of the bottom band
    expect(edgeScrollStep(99, 100, 900)).toBe(0);    // over the header above the box
    expect(edgeScrollStep(901, 100, 900)).toBe(0);
    expect(edgeScrollStep(500, 900, 100)).toBe(0);   // an inverted box
    expect(edgeScrollStep(100, 100, 100)).toBe(0);   // an empty box
  });

  it("scrolls up near the top, faster at the edge", () => {
    expect(edgeScrollStep(100, 100, 900)).toBe(-14);
    expect(edgeScrollStep(124, 100, 900)).toBe(-7);
    expect(edgeScrollStep(147, 100, 900)).toBe(-1);  // never rounds to a dead zero inside the band
  });

  it("scrolls down near the bottom, faster at the edge", () => {
    expect(edgeScrollStep(900, 100, 900)).toBe(14);
    expect(edgeScrollStep(876, 100, 900)).toBe(7);
    expect(edgeScrollStep(853, 100, 900)).toBe(1);
  });

  it("takes the margin and the step from the caller", () => {
    expect(edgeScrollStep(110, 100, 900, 20, 40)).toBe(-20);
    expect(edgeScrollStep(890, 100, 900, 20, 40)).toBe(20);
    expect(edgeScrollStep(130, 100, 900, 20, 40)).toBe(0);
  });

  it("halves the band for a box shorter than two margins", () => {
    expect(edgeScrollStep(110, 100, 140)).toBe(-7);  // band 20: halfway into the top band
    expect(edgeScrollStep(120, 100, 140)).toBe(0);   // the middle line belongs to neither band
    expect(edgeScrollStep(130, 100, 140)).toBe(7);
  });
});
