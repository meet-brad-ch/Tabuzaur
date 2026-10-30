import type { Link } from "../lib/model.ts";
import { TextSearch } from "../lib/text-search.ts";
import { UrlText } from "../lib/urls.ts";

/** The names of the stroke icons. */
export type IconName =
  "pen" | "trash" | "close" | "sun" | "moon" | "auto" | "chevron" | "pin" | "search" | "plus" | "download" | "upload" | "gear" | "help";

/** Element builders shared by every view. */
export class Dom {
  /**
   * A new element.
   * @param tag the tag name
   * @param className the class attribute; omitted when empty
   * @returns the element, not yet in the document
   */
  static el(tag: string, className = ""): HTMLElement {
    const node = document.createElement(tag);
    if (className !== "") {
      node.className = className;
    }
    return node;
  }

  /**
   * A new input element.
   * @param type the input type
   * @param className the class attribute; omitted when empty
   * @returns the input
   */
  static input(type: string, className = ""): HTMLInputElement {
    const node = Dom.el("input", className) as HTMLInputElement;
    node.type = type;
    return node;
  }

  /**
   * A button of type "button" that runs the handler on click.
   * @param className the class attribute
   * @param onClick the click handler
   * @returns the button, without content
   */
  static button(className: string, onClick: () => void): HTMLButtonElement {
    const node = Dom.el("button", className) as HTMLButtonElement;
    node.type = "button";
    node.addEventListener("click", onClick);
    return node;
  }

  /**
   * A button with a text label.
   * @param className the class attribute
   * @param label the visible text
   * @param onClick the click handler
   * @returns the button
   */
  static textButton(className: string, label: string, onClick: () => void): HTMLButtonElement {
    const node = Dom.button(className, onClick);
    node.textContent = label;
    return node;
  }

  /**
   * A text node.
   * @param content the text
   * @returns the node
   */
  static text(content: string): Text {
    return document.createTextNode(content);
  }

  /**
   * A tooltip for the pointer and the same text for a screen reader, on a button that shows only
   * an icon.
   * @param node the element to label
   * @param label the text
   */
  static labelled(node: HTMLElement, label: string): void {
    node.title = label;
    node.setAttribute("aria-label", label);
  }

  /**
   * Puts the focus into the input and selects its text.
   * @param input the input, or null when the render did not produce one
   */
  static focusAndSelect(input: HTMLInputElement | null): void {
    if (input === null) {
      return;
    }
    input.focus();
    input.select();
  }

  /**
   * The text with its first match of the query wrapped in a mark element.
   * @param content the text to show
   * @param query the search query
   * @returns the plain text when there is no match, else the text before, the mark and the rest
   */
  static marked(content: string, query: string): (string | HTMLElement)[] {
    const match = TextSearch.firstMatch(content, query);
    if (match === undefined) {
      return [content];
    }
    const mark = Dom.el("mark");
    mark.textContent = match.match;
    return [match.before, mark, match.after];
  }

  /**
   * Hands the viewer a JSON file to save.
   * @param name the suggested file name
   * @param text the file content
   */
  static download(name: string, text: string): void {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = Dom.el("a") as HTMLAnchorElement;
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  /**
   * The page's favicon, or a lettered tile colored by its host when it has none or it fails to load.
   * @param page the link or tab
   * @returns an img or a span
   */
  static favicon(page: Link): HTMLElement {
    if (page.favIconUrl === undefined) {
      return Dom.letterTile(page.url);
    }
    const img = Dom.el("img", "favicon") as HTMLImageElement;
    img.src = page.favIconUrl;
    img.alt = "";
    img.addEventListener("error", () => {
      img.replaceWith(Dom.letterTile(page.url));
    });
    return img;
  }

  /**
   * A tile with the host's initial on a color derived from the host.
   * @param url the page address
   * @returns the tile
   */
  private static letterTile(url: string): HTMLElement {
    const tile = Dom.el("span", "favicon letter");
    tile.textContent = UrlText.initial(url);
    const host = UrlText.hostname(url);
    tile.style.setProperty("--h", String(UrlText.hue(host)));
    return tile;
  }
}

/** The stroke icons (24-unit grid, drawn with currentColor) and the empty-card drawing. */
export class Icons {
  private static readonly SVG_NS = "http://www.w3.org/2000/svg";

  private static readonly PATHS: Record<IconName, string> = {
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
    auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    pin: '<path d="M12 17v5"/><path d="M9 3h6l-1 7 3 3H7l3-3z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 19h16"/>',
    upload: '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M4 19h16"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5"/><path d="M12 17h.01"/>',
  };

  /** The empty-card drawing: a tab sliding into a folder. */
  private static readonly EMPTY_ART =
    '<rect x="6" y="16" width="42" height="30" rx="5"/><path d="M6 25h42"/><circle cx="12" cy="20.5" r="1.5" fill="currentColor"/>' +
    '<path d="M56 31h16m-5-5 5 5-5 5"/><path d="M80 22h13l4 4h23v22H80z"/>';

  /**
   * An icon, hidden from screen readers (the button that holds it carries the label).
   * @param name the icon
   * @returns the svg element
   */
  static icon(name: IconName): SVGElement {
    const svg = document.createElementNS(Icons.SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", "icon");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = Icons.PATHS[name];
    return svg;
  }

  /**
   * The empty-card drawing.
   * @returns the svg element
   */
  static emptyArt(): SVGElement {
    const art = document.createElementNS(Icons.SVG_NS, "svg");
    art.setAttribute("viewBox", "0 0 124 64");
    art.setAttribute("class", "art");
    art.innerHTML = Icons.EMPTY_ART;
    return art;
  }
}
