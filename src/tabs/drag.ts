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
  /** true for an address dropped from outside the page: the address bar's site icon, or a link on a page. */
  readonly outside?: true;
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
  /** An address from outside the page: Chrome's site icon in the address bar, or a link on a page. */
  static readonly ADDRESS = "text/uri-list";

  /**
   * What a drag carries, from its types (readable during dragover). An address from outside the
   * page is a link.
   * @param transfer the event's data transfer, null for synthetic events
   * @returns the kind, or undefined for a drag that carries none of them (text, a file)
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
    if (types.includes(DragKinds.ADDRESS)) {
      return "link";
    }
    return undefined;
  }

  /**
   * The drop effect a link drag may have: a saved link moves, an open tab is copied, and an
   * address from outside the page is copied or linked, as its source allows.
   * @param transfer the event's data transfer
   * @returns the drop effect
   */
  static linkEffect(transfer: DataTransfer): "move" | "copy" | "link" {
    const allowed = transfer.effectAllowed;
    if (allowed === "move") {
      return "move";
    }
    if (allowed === "link") {
      return "link";
    }
    return "copy";
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
   * The link a drop carries: a link of the page, or an address from outside it.
   * @param event the drop event
   * @returns the link drag, or undefined when the drop carries no link
   */
  static readLink(event: DragEvent): LinkDrag | undefined {
    const transfer = event.dataTransfer;
    if (transfer === null) {
      return undefined;
    }
    const raw = transfer.getData(DragKinds.LINK);
    if (raw !== "") {
      return JSON.parse(raw) as LinkDrag;
    }
    return DragKinds.readAddress(transfer);
  }

  /**
   * An address dropped from outside the page. Its title is the link text when the drop has one (a
   * link on a page), else the address; the controller takes the title of an open tab first.
   * @param transfer the drop's data transfer
   * @returns the link drag, or undefined when the drop has no address
   */
  private static readAddress(transfer: DataTransfer): LinkDrag | undefined {
    const url = DragKinds.firstAddress(transfer.getData(DragKinds.ADDRESS));
    if (url === "") {
      return undefined;
    }
    const text = DragKinds.linkText(transfer.getData("text/html"));
    const title = text === "" ? url : text;
    return { link: { title, url }, outside: true };
  }

  /**
   * The first address of a text/uri-list: lines starting with # are comments.
   * @param list the list
   * @returns the address, or an empty string when the list has none
   */
  private static firstAddress(list: string): string {
    for (const line of list.split(/\r?\n/)) {
      const address = line.trim();
      if (address !== "" && !address.startsWith("#")) {
        return address;
      }
    }
    return "";
  }

  /**
   * The text of the first link in dropped HTML.
   * @param html the drop's text/html data, empty when it has none
   * @returns the link text, trimmed, or an empty string
   */
  private static linkText(html: string): string {
    if (html === "") {
      return "";
    }
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const text = parsed.querySelector("a")?.textContent ?? "";
    return text.trim();
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

/**
 * Keeps a drop that no card or tab took from leaving the page. Chrome opens a dropped address or
 * file in the tab when the page does not take the drop, which would replace Tabuzaur. The guard
 * listens on the document, after the targets: a drag that no target accepted shows "no drop", and
 * a drop is always cancelled there.
 */
export class DropGuard {
  /**
   * Starts listening.
   * @param page the document of the page
   */
  static install(page: Document): void {
    page.addEventListener("dragover", (event) => {
      if (event.defaultPrevented || event.dataTransfer === null) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "none";
    });
    page.addEventListener("drop", (event) => {
      event.preventDefault();
    });
  }
}
