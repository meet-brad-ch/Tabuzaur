/** What is being dragged. */
export type DragKind = "link" | "card" | "collection";

/** What the pointer is over. */
export type DropTarget = "card" | "link" | "tab";

/**
 * Which drag may drop where. A link goes into a card (at its end, or before or after a link row);
 * a card moves among the cards or onto a collection tab; a collection moves among the tabs.
 * Everything else is refused, so the pointer shows "no drop".
 */
export class DropRules {
  private static readonly ALLOWED: Record<DragKind, readonly DropTarget[]> = {
    link: ["card", "link"],
    card: ["card", "tab"],
    collection: ["tab"],
  };

  /**
   * Whether a drag may drop on a target.
   * @param kind what is dragged
   * @param target what is under the pointer
   * @returns true when the drop is allowed
   */
  static accepts(kind: DragKind, target: DropTarget): boolean {
    return DropRules.ALLOWED[kind].includes(target);
  }
}
