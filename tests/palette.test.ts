import { describe, expect, it } from "vitest";
import { HUE_COUNT } from "../src/lib/model.ts";
import { Palette } from "../src/lib/palette.ts";

describe("Palette.next", () => {
  it("starts at 0 and follows the last hue when all are used equally", () => {
    expect(Palette.next([])).toBe(0);
    expect(Palette.next([0])).toBe(1);
    expect(Palette.next([0, 1, 2])).toBe(3);
  });

  it("prefers the least-used hue, searching from the one after the last", () => {
    expect(Palette.next([3, 4, 3])).toBe(5);
    const full = Array.from({ length: HUE_COUNT }, (_, i) => i);
    expect(Palette.next(full)).toBe(0);
    expect(Palette.next([...full, 0])).toBe(1);
  });

  it("ignores cards without a hue when counting and starts at 0 after one", () => {
    expect(Palette.next([2, undefined])).toBe(0);
    expect(Palette.next([undefined, 0])).toBe(1);
  });
});

describe("Palette.nextTab", () => {
  it("starts at 0 and steps 5 hues on, so neighbouring tabs differ clearly", () => {
    expect(Palette.nextTab([])).toBe(0);
    expect(Palette.nextTab([0])).toBe(5);
    expect(Palette.nextTab([0, 5])).toBe(10);
  });

  it("takes the least-used hue when the next one is taken", () => {
    expect(Palette.nextTab([0, 5, 5])).toBe(10);
    expect(Palette.nextTab([10, 0, 5])).toBe(15);
  });

  it("gives every place the hue nextTab would have given", () => {
    const hues: number[] = [];
    for (let place = 0; place < HUE_COUNT + 2; place++) {
      expect(Palette.tabAt(place)).toBe(Palette.nextTab(hues));
      hues.push(Palette.tabAt(place));
    }
  });
});
