import type { DragKind } from "../lib/drop-rules.ts";
import type { Link } from "../lib/model.ts";

/** Where a dragged link comes from when it is already saved in a card. */
export interface LinkSource {
  readonly cardId: string;
  readonly index: number;
}

/** What a link drag carries: the link, and its card and place when it is already saved. */
export interface LinkDrag {
  readonly link: Link;
  readonly from?: LinkSource;
}

/**
 * The kinds of drag on the page and their data. During dragover only the types are readable, so
 * each kind has its own MIME type; the data is read on drop.
 */
export class DragKinds {
  /** A link: an open tab from the panel, or a saved link. */
  static readonly LINK = "application/x-tabuzaur-page";
  /** A card, dragged by its colored band; the data is the card id. */
  static readonly CARD = "application/x-tabuzaur-card";
  /** A collection, dragged by its tab; the data is the collection id. */
  static readonly COLLECTION = "application/x-tabuzaur-collection";

  /**
   * What a drag carries, from its types (readable during dragover).
   * @param transfer the event's data transfer, null for synthetic events
   * @returns the kind, or undefined for a drag from outside the page
   */
  static kindOf(transfer: DataTransfer | null): DragKind | undefined {
    if (transfer === null) {
      return undefined;
    }
    const types = transfer.types;
    if (types.includes(DragKinds.LINK)) {
      return "link";
    }
    if (types.includes(DragKinds.CARD)) {
      return "card";
    }
    if (types.includes(DragKinds.COLLECTION)) {
      return "collection";
    }
    return undefined;
  }

  /**
   * Starts a link drag from a row: a tab is copied, a saved link is moved.
   * @param event the dragstart event
   * @param row the dragged row; it fades once the browser took the drag image
   * @param drag what the drag carries
   */
  static startLink(event: DragEvent, row: HTMLElement, drag: LinkDrag): void {
    const transfer = event.dataTransfer;
    if (transfer === null) {
      return;
    }
    transfer.setData(DragKinds.LINK, JSON.stringify(drag));
    transfer.effectAllowed = drag.from === undefined ? "copy" : "move";
    setTimeout(() => {
      row.classList.add("dragging");
    }, 0);
  }

  /**
   * The link a drop carries.
   * @param event the drop event
   * @returns the link drag, or undefined when the drop carries no link
   */
  static readLink(event: DragEvent): LinkDrag | undefined {
    const raw = event.dataTransfer?.getData(DragKinds.LINK) ?? "";
    if (raw === "") {
      return undefined;
    }
    return JSON.parse(raw) as LinkDrag;
  }

  /**
   * Starts a card drag from its band.
   * @param event the dragstart event
   * @param card the card element, used as the drag image
   * @param cardId the card's id
   */
  static startCard(event: DragEvent, card: HTMLElement, cardId: string): void {
    const transfer = event.dataTransfer;
    if (transfer === null) {
      return;
    }
    transfer.setData(DragKinds.CARD, cardId);
    transfer.effectAllowed = "move";
    transfer.setDragImage(card, 24, 20);
    setTimeout(() => {
      card.classList.add("dragging");
    }, 0);
  }

  /**
   * The card id a drop carries.
   * @param event the drop event
   * @returns the id, or an empty string when the drop carries no card
   */
  static readCard(event: DragEvent): string {
    return event.dataTransfer?.getData(DragKinds.CARD) ?? "";
  }

  /**
   * Starts a collection drag from its tab.
   * @param event the dragstart event
   * @param tab the tab element
   * @param collectionId the collection's id
   */
  static startCollection(event: DragEvent, tab: HTMLElement, collectionId: string): void {
    const transfer = event.dataTransfer;
    if (transfer === null) {
      return;
    }
    transfer.setData(DragKinds.COLLECTION, collectionId);
    transfer.effectAllowed = "move";
    setTimeout(() => {
      tab.classList.add("dragging");
    }, 0);
  }

  /**
   * The collection id a drop carries.
   * @param event the drop event
   * @returns the id, or an empty string when the drop carries no collection
   */
  static readCollection(event: DragEvent): string {
    return event.dataTransfer?.getData(DragKinds.COLLECTION) ?? "";
  }

  /**
   * Whether the pointer is in the right half of the element: the drop goes after it.
   * @param target the element under the pointer
   * @param event the drag event
   * @returns true for the right half
   */
  static isRightHalf(target: HTMLElement, event: DragEvent): boolean {
    const box = target.getBoundingClientRect();
    const fromLeft = event.clientX - box.left;
    return fromLeft > box.width / 2;
  }

  /**
   * Whether the pointer is in the lower half of the element: the drop goes after it.
   * @param target the element under the pointer
   * @param event the drag event
   * @returns true for the lower half
   */
  static isLowerHalf(target: HTMLElement, event: DragEvent): boolean {
    const box = target.getBoundingClientRect();
    const fromTop = event.clientY - box.top;
    return fromTop > box.height / 2;
  }
}
