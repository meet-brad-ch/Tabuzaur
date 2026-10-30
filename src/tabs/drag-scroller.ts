import { EdgeScroll } from "../lib/autoscroll.ts";

/**
 * Scrolls the cards while a drag rests near their top or bottom edge, so a card below the fold
 * can take the drop. The wheel does not reach the page during a native drag, and Chrome's own
 * drag autoscroll only acts in a 20px belt after a delay, which is easy to miss. Each dragover
 * over the area records the pointer; a frame loop scrolls by the edge step until the drag ends,
 * drops, or the dragover events stop (the pointer left the area).
 */
export class DragScroller {
  /** Chrome repeats dragover at least every 350ms while the pointer rests; longer silence means it left. */
  private static readonly SILENCE_MS = 500;

  private pointerY = Number.NaN;
  private lastOver = 0;
  private frame = 0;

  /**
   * Starts listening.
   * @param area the scrolling element
   * @param sources the elements whose dragend ends a drag that may have passed over the area
   */
  constructor(private readonly area: HTMLElement, sources: readonly HTMLElement[]) {
    area.addEventListener("dragover", (event) => {
      this.over(event);
    });
    area.addEventListener("drop", () => {
      this.stop();
    });
    for (const source of sources) {
      source.addEventListener("dragend", () => {
        this.stop();
      });
    }
  }

  /**
   * Records the pointer and starts the frame loop when it is not running.
   * @param event the dragover event
   */
  private over(event: DragEvent): void {
    this.pointerY = event.clientY;
    this.lastOver = performance.now();
    if (this.frame === 0) {
      this.frame = requestAnimationFrame(this.tick);
    }
  }

  /**
   * One frame: scroll by the edge step, then schedule the next frame, until dragover went silent.
   * @param now the frame time in milliseconds
   */
  private readonly tick = (now: number): void => {
    this.frame = 0;
    if (now - this.lastOver > DragScroller.SILENCE_MS) {
      return;
    }
    const box = this.area.getBoundingClientRect();
    const step = EdgeScroll.step(this.pointerY, box.top, box.bottom, EdgeScroll.MARGIN, EdgeScroll.MAX_STEP);
    if (step !== 0) {
      this.area.scrollTop += step;
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  /** Ends the frame loop. */
  private stop(): void {
    if (this.frame !== 0) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
  }
}
