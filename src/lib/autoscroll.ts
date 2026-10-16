/**
 * Scroll step for a pointer held near the edge of a scrolling box during a drag.
 *
 * During a native drag the wheel does not scroll the page, so the collections area scrolls by
 * itself while the pointer rests in a band along its top or bottom edge. The step grows from
 * nothing at the inner side of the band to `maxStep` at the edge, so a slow approach gives a
 * slow scroll. Outside the box (over the header, for example) the step is zero.
 *
 * @param y pointer position, same axis and origin as `top` and `bottom`
 * @param top where the box starts
 * @param bottom where the box ends
 * @param margin depth of the band at each edge, in the same unit; a short box gets two half-boxes
 * @param maxStep step at the edge, in the same unit per call (negative upwards)
 * @returns the step to add to the scroll position: negative near the top, positive near the bottom, 0 elsewhere
 */
export function edgeScrollStep(y: number, top: number, bottom: number, margin = 48, maxStep = 14): number {
  if (!(y >= top && y <= bottom) || bottom <= top) {
    return 0;
  }
  const band = Math.min(margin, (bottom - top) / 2);
  if (band <= 0) {
    return 0;
  }
  const fromTop = y - top;
  const fromBottom = bottom - y;
  if (fromTop < band) {
    return -Math.ceil(maxStep * (1 - fromTop / band));
  }
  if (fromBottom < band) {
    return Math.ceil(maxStep * (1 - fromBottom / band));
  }
  return 0;
}
