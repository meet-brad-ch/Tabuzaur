/**
 * Scroll step for a pointer held near the edge of a scrolling box during a drag.
 *
 * During a native drag the wheel does not scroll the page, so the cards area scrolls by itself
 * while the pointer rests in a band along its top or bottom edge. The step grows from nothing at
 * the inner side of the band to `maxStep` at the edge, so a slow approach gives a slow scroll.
 * Outside the box (over the header, for example) the step is zero.
 */
export class EdgeScroll {
  /** Depth of the band at each edge, in CSS pixels. */
  static readonly MARGIN = 48;
  /** Step at the very edge, in CSS pixels per animation frame. */
  static readonly MAX_STEP = 14;

  /**
   * The step to add to the scroll position for one animation frame.
   * @param y pointer position, same axis and origin as `top` and `bottom`
   * @param top where the box starts
   * @param bottom where the box ends
   * @param margin depth of the band at each edge, same unit; a short box gets two half-boxes
   * @param maxStep step at the edge, same unit per call
   * @returns negative near the top, positive near the bottom, 0 elsewhere and outside the box
   */
  static step(y: number, top: number, bottom: number, margin: number, maxStep: number): number {
    const inside = y >= top && y <= bottom && bottom > top;
    if (!inside) {
      return 0;
    }
    const band = Math.min(margin, (bottom - top) / 2);
    if (band <= 0) {
      return 0;
    }
    const fromTop = y - top;
    const fromBottom = bottom - y;
    if (fromTop < band) {
      const depth = 1 - fromTop / band;
      return -Math.ceil(maxStep * depth);
    }
    if (fromBottom < band) {
      const depth = 1 - fromBottom / band;
      return Math.ceil(maxStep * depth);
    }
    return 0;
  }
}
