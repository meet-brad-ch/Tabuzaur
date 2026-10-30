import { HUE_COUNT } from "./model.ts";

/**
 * Chooses the color of a new card or collection from the stylesheet's palette of HUE_COUNT hues:
 * the least-used hue, looking from the one after the last hue, so neighbours differ and the palette
 * is spent evenly.
 */
export class Palette {
  /**
   * The step between the hues of neighbouring tabs. Neighbouring palette entries are close shades,
   * so tabs skip ahead to look clearly different. 5 shares no factor with HUE_COUNT, so the search
   * still visits every hue.
   */
  static readonly TAB_STEP = 5;

  /**
   * The hue for a new card.
   * @param hues the hues of all cards in document order; undefined for a card without one yet
   * @returns a hue index, 0 to HUE_COUNT - 1
   */
  static next(hues: readonly (number | undefined)[]): number {
    const counts = Palette.counts(hues);
    const last = Palette.lastHue(hues);
    return Palette.leastUsed(counts, last + 1, 1);
  }

  /**
   * The hue for a new collection: like a card, but TAB_STEP hues on from the last tab.
   * @param hues the hues of all collections in order
   * @returns a hue index, 0 to HUE_COUNT - 1
   */
  static nextTab(hues: readonly number[]): number {
    const counts = Palette.counts(hues);
    const last = Palette.lastHue(hues);
    const start = last < 0 ? 0 : last + Palette.TAB_STEP;
    return Palette.leastUsed(counts, start, Palette.TAB_STEP);
  }

  /**
   * The hue of a collection in a file that has no tab colors (Tabuzaur 0.9.0): the hue nextTab
   * gives when the tabs before it got theirs the same way.
   * @param place its place in the file, from 0
   * @returns a hue index, 0 to HUE_COUNT - 1
   */
  static tabAt(place: number): number {
    return (place * Palette.TAB_STEP) % HUE_COUNT;
  }

  /**
   * How many cards use each hue.
   * @param hues the hues of all cards; undefined entries are not counted
   * @returns HUE_COUNT counts, indexed by hue
   */
  private static counts(hues: readonly (number | undefined)[]): number[] {
    const counts = new Array<number>(HUE_COUNT).fill(0);
    for (const hue of hues) {
      if (hue !== undefined) {
        counts[hue] = (counts[hue] ?? 0) + 1;
      }
    }
    return counts;
  }

  /**
   * The hue of the last card.
   * @param hues the hues of all cards
   * @returns that hue, or -1 when there is no card or it has no hue yet
   */
  private static lastHue(hues: readonly (number | undefined)[]): number {
    const last = hues[hues.length - 1];
    if (last === undefined) {
      return -1;
    }
    return last;
  }

  /**
   * The least-used hue, searching the circle from `start` in steps of `stride`; the first one wins
   * a tie.
   * @param counts HUE_COUNT counts, indexed by hue
   * @param start the first hue the search looks at; taken modulo HUE_COUNT
   * @param stride the step between the hues it looks at; shares no factor with HUE_COUNT
   * @returns a hue index
   */
  private static leastUsed(counts: readonly number[], start: number, stride: number): number {
    let best = start % HUE_COUNT;
    for (let step = 0; step < HUE_COUNT; step++) {
      const hue = (start + stride * step) % HUE_COUNT;
      const count = counts[hue] ?? 0;
      const bestCount = counts[best] ?? 0;
      if (count < bestCount) {
        best = hue;
      }
    }
    return best;
  }
}
