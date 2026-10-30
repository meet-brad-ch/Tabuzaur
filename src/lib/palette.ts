import { HUE_COUNT } from "./model.ts";

/**
 * Chooses the color of a new card from the stylesheet's palette of HUE_COUNT hues: the least-used
 * hue, looking from the one after the last card's hue, so neighbours differ and the palette is
 * spent evenly.
 */
export class Palette {
  /**
   * The hue for a new card.
   * @param hues the hues of all cards in document order; undefined for a card without one yet
   * @returns a hue index, 0 to HUE_COUNT - 1
   */
  static next(hues: readonly (number | undefined)[]): number {
    const counts = Palette.counts(hues);
    const last = Palette.lastHue(hues);
    return Palette.leastUsedAfter(counts, last);
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
   * The least-used hue, searching the circle from the one after `last`; the first one wins a tie.
   * @param counts HUE_COUNT counts, indexed by hue
   * @param last the hue the search starts after, -1 to start at 0
   * @returns a hue index
   */
  private static leastUsedAfter(counts: readonly number[], last: number): number {
    let best = (last + 1) % HUE_COUNT;
    for (let step = 0; step < HUE_COUNT; step++) {
      const hue = (last + 1 + step) % HUE_COUNT;
      const count = counts[hue] ?? 0;
      const bestCount = counts[best] ?? 0;
      if (count < bestCount) {
        best = hue;
      }
    }
    return best;
  }
}
