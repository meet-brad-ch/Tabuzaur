import { CollectionBook, findMatch } from "../lib/collections.ts";
import type { Clock, Collection, IdSource, SavedPage } from "../lib/model.ts";
import { RandomIdSource, SystemClock } from "../lib/model.ts";
import type { Persistence, Theme } from "../lib/storage.ts";
import { LocalPersistence, THEMES, ThemeStore } from "../lib/storage.ts";
import type { OpenTab, TabBrowser } from "../lib/tabs.ts";
import { ChromeTabBrowser } from "../lib/tabs.ts";
import { hostnameOf, hueOf, initialOf } from "../lib/urls.ts";

const DRAG_TYPE = "application/x-tabuzaur-page";
const HUE_COUNT = 8;
const SVG_NS = "http://www.w3.org/2000/svg";

/** Stroke icons, 24-unit grid, drawn with currentColor. */
const ICONS = {
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
  auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
} as const;

/** The empty-card drawing: a tab sliding into a folder. */
const EMPTY_ART =
  '<rect x="6" y="16" width="42" height="30" rx="5"/><path d="M6 25h42"/><circle cx="12" cy="20.5" r="1.5" fill="currentColor"/>' +
  '<path d="M56 31h16m-5-5 5 5-5 5"/><path d="M80 22h13l4 4h23v22H80z"/>';

/** What a drag carries: a page, and where it comes from when it is already in a collection. */
interface DragPayload {
  readonly page: SavedPage;
  readonly from?: { readonly collectionId: string; readonly index: number };
}

interface PageRef {
  readonly collectionId: string;
  readonly index: number;
}

/** The Tabuzaur page: open tabs on the left, collections on the right, drag from left to right. */
class TabsPage {
  private book = CollectionBook.empty();
  private openTabs: readonly OpenTab[] = [];
  private ownWindowId = -1;
  private query = "";
  private tabQuery = "";
  private theme: Theme = "system";
  private renaming: string | undefined;
  private editingPage: PageRef | undefined;
  private justAdded: { collectionId: string; url: string } | undefined;
  private readonly collapsed = new Set<number>();
  private readonly darkSystem = window.matchMedia("(prefers-color-scheme: dark)");

  constructor(
    private readonly root: HTMLElement,
    private readonly ownUrl: string,
    private readonly persistence: Persistence,
    private readonly themes: ThemeStore,
    private readonly browser: TabBrowser,
    private readonly clock: Clock,
    private readonly ids: IdSource,
  ) {}

  async start(): Promise<void> {
    this.theme = await this.themes.load();
    this.applyTheme();
    this.darkSystem.addEventListener("change", () => { this.applyTheme(); });
    await this.loadBook();
    this.ownWindowId = await this.browser.currentWindowId();
    this.openTabs = await this.browser.openTabs();
    this.render();
    this.browser.onChange(() => {
      this.run(async () => {
        this.openTabs = await this.browser.openTabs();
      }, () => { this.renderSidebar(); });
    });
    this.persistence.onChange(() => {
      this.run(() => this.loadBook());
    });
  }

  private async loadBook(): Promise<void> {
    const data = await this.persistence.load();
    this.book = data === undefined ? CollectionBook.empty() : CollectionBook.fromData(data);
  }

  /** Resolves "system" to the OS choice, so the stylesheet only knows light and dark. */
  private applyTheme(): void {
    const effective = this.theme === "system" ? (this.darkSystem.matches ? "dark" : "light") : this.theme;
    document.documentElement.dataset.theme = effective;
  }

  // ---- rendering --------------------------------------------------------------------------

  private render(): void {
    this.root.replaceChildren(this.header(), el("p", "notice"), this.layout());
    this.root.querySelector<HTMLElement>(".notice")?.setAttribute("hidden", "");
  }

  private header(): HTMLElement {
    const header = el("header", "top");
    const brand = el("div", "brand");
    const logo = el("img", "logo") as HTMLImageElement;
    logo.src = "icons/icon-128.png";
    logo.alt = "";
    const words = el("div", "words");
    const title = el("h1");
    const tabu = el("span", "tabu");
    tabu.textContent = "Tabu";
    const zaur = el("span", "zaur");
    zaur.textContent = "zaur";
    title.append(tabu, zaur);
    const tagline = el("span", "tagline");
    tagline.textContent = "Tame your tabs";
    words.append(title, tagline);
    brand.append(logo, words);

    const search = el("label", "field search");
    const input = el("input") as HTMLInputElement;
    input.type = "search";
    input.placeholder = "Search collections and links";
    input.value = this.query;
    input.addEventListener("input", () => {
      this.query = input.value;
      this.renderCollections();
    });
    search.append(icon("search"), input);

    const form = el("form", "field create") as HTMLFormElement;
    const name = el("input") as HTMLInputElement;
    name.type = "text";
    name.placeholder = "New collection";
    name.required = true;
    const create = button(undefined, "submit", "primary");
    create.append(icon("plus"), text("Create"));
    form.append(name, create);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.run(() => this.change(this.book.create(name.value, this.clock, this.ids)));
    });

    header.append(brand, search, form, this.themeButton());
    return header;
  }

  private themeButton(): HTMLElement {
    const names: Record<Theme, keyof typeof ICONS> = { system: "auto", light: "sun", dark: "moon" };
    const labels: Record<Theme, string> = { system: "Theme: follows the system", light: "Theme: light", dark: "Theme: dark" };
    const toggle = button(() => {
      const next = THEMES[(THEMES.indexOf(this.theme) + 1) % THEMES.length] ?? "system";
      this.run(async () => {
        await this.themes.save(next);
        this.theme = next;
        this.applyTheme();
      });
    }, "button", "icon theme");
    toggle.append(icon(names[this.theme]));
    toggle.title = `${labels[this.theme]} (click to change)`;
    return toggle;
  }

  private layout(): HTMLElement {
    const layout = el("div", "layout");
    const aside = el("aside");
    const main = el("main");
    layout.append(aside, main);
    this.fillSidebar(aside);
    this.fillCollections(main);
    return layout;
  }

  private renderSidebar(): void {
    this.fillSidebar(this.must("aside"));
  }

  private renderCollections(): void {
    this.fillCollections(this.must("main"));
  }

  private must(selector: string): HTMLElement {
    const node = this.root.querySelector<HTMLElement>(selector);
    if (node === null) {
      throw new Error(`the page has no ${selector}`);
    }
    return node;
  }

  // ---- sidebar: open tabs -----------------------------------------------------------------

  private fillSidebar(aside: HTMLElement): void {
    const head = el("div", "side-head");
    const heading = el("h2");
    heading.textContent = "Open tabs";
    const filter = el("label", "field search small");
    const input = el("input") as HTMLInputElement;
    input.type = "search";
    input.placeholder = "Filter tabs";
    input.value = this.tabQuery;
    input.addEventListener("input", () => {
      this.tabQuery = input.value;
      this.renderSidebar();
      this.root.querySelector<HTMLInputElement>("aside .search input")?.focus();
    });
    filter.append(icon("search"), input);
    head.append(heading, filter);
    aside.replaceChildren(head);

    const tabs = this.openTabs.filter((t) => t.url !== this.ownUrl && this.tabMatches(t));
    const windowIds = [...new Set(tabs.map((t) => t.windowId))].sort(
      (a, b) => Number(b === this.ownWindowId) - Number(a === this.ownWindowId) || a - b,
    );
    for (const windowId of windowIds) {
      const group = el("details", "window") as HTMLDetailsElement;
      group.open = !this.collapsed.has(windowId);
      group.addEventListener("toggle", () => {
        if (group.open) {
          this.collapsed.delete(windowId);
        } else {
          this.collapsed.add(windowId);
        }
      });
      const summary = el("summary");
      const inWindow = tabs.filter((t) => t.windowId === windowId);
      const label = el("span", "label");
      label.textContent = windowId === this.ownWindowId ? "This window" : `Window ${String(windowId)}`;
      const count = el("span", "count");
      count.textContent = String(inWindow.length);
      summary.append(icon("chevron"), label, count);
      const list = el("ul");
      list.append(...inWindow.map((t) => this.tabRow(t)));
      group.append(summary, list);
      aside.append(group);
    }
    if (tabs.length === 0) {
      const empty = el("p", "empty");
      empty.textContent = this.tabQuery.trim() === "" ? "No other tabs are open." : "No open tab matches.";
      aside.append(empty);
    }
  }

  private tabMatches(tab: OpenTab): boolean {
    return this.tabQuery.trim() === ""
      || findMatch(tab.title, this.tabQuery) !== undefined
      || findMatch(tab.url, this.tabQuery) !== undefined;
  }

  private tabRow(tab: OpenTab): HTMLElement {
    const row = el("li", tab.active ? "tab active" : "tab");
    row.draggable = true;
    row.title = tab.url;
    const body = el("span", "text");
    const title = el("span", "title");
    title.replaceChildren(...marked(tab.title, this.tabQuery));
    const host = el("span", "host");
    host.replaceChildren(...marked(hostnameOf(tab.url), this.tabQuery));
    body.append(title, host);
    row.append(favicon(tab), body);
    row.addEventListener("click", () => { this.run(() => this.browser.activate(tab)); });
    row.addEventListener("dragstart", (event) => {
      const page: SavedPage = tab.favIconUrl === undefined
        ? { title: tab.title, url: tab.url }
        : { title: tab.title, url: tab.url, favIconUrl: tab.favIconUrl };
      startDrag(event, row, { page });
    });
    row.addEventListener("dragend", () => { row.classList.remove("dragging"); });
    return row;
  }

  // ---- main: collections ------------------------------------------------------------------

  private fillCollections(main: HTMLElement): void {
    const heading = el("h2");
    heading.textContent = "Collections";
    main.replaceChildren(heading);
    const shown = this.book.search(this.query);
    if (shown.length === 0) {
      const empty = el("p", "empty");
      empty.textContent = this.book.collections.length === 0
        ? "No collections yet. Create one above, then drag tabs into it."
        : "Nothing matches.";
      main.append(empty);
      return;
    }
    const cards = el("div", "cards");
    cards.append(...shown.map((c) => this.card(c, this.book.collections.indexOf(c) % HUE_COUNT)));
    main.append(cards);
    this.justAdded = undefined;
  }

  private card(collection: Collection, hue: number): HTMLElement {
    const card = el("section", `card hue-${String(hue)}`);
    card.addEventListener("dragover", (event) => {
      if (event.dataTransfer?.types.includes(DRAG_TYPE) === true) {
        event.preventDefault();
        event.dataTransfer.dropEffect = event.dataTransfer.effectAllowed === "move" ? "move" : "copy";
        card.classList.add("over");
      }
    });
    card.addEventListener("dragleave", (event) => {
      if (!card.contains(event.relatedTarget as Node | null)) {
        card.classList.remove("over");
      }
    });
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      card.classList.remove("over");
      this.dropInto(collection, event, undefined);
    });

    const header = el("header");
    header.append(...this.nameField(collection), this.deleteButton(collection));
    card.append(header);

    if (collection.pages.length === 0) {
      const hint = el("div", "empty-hint");
      const art = document.createElementNS(SVG_NS, "svg");
      art.setAttribute("viewBox", "0 0 124 64");
      art.setAttribute("class", "art");
      art.innerHTML = EMPTY_ART;
      const caption = el("span");
      caption.textContent = "Drop tabs here";
      hint.append(art, caption);
      card.append(hint);
      return card;
    }

    const list = el("ul");
    collection.pages.forEach((page, index) => {
      const classes = ["page"];
      if (findMatch(page.title, this.query) !== undefined || findMatch(page.url, this.query) !== undefined) {
        classes.push("hit");
      }
      if (this.justAdded?.collectionId === collection.id && this.justAdded.url === page.url) {
        classes.push("new");
      }
      const row = el("li", classes.join(" "));
      row.draggable = true;
      row.addEventListener("dragstart", (event) => {
        startDrag(event, row, { page, from: { collectionId: collection.id, index } });
      });
      row.addEventListener("dragend", () => { row.classList.remove("dragging"); });
      row.addEventListener("dragover", (event) => {
        if (event.dataTransfer?.types.includes(DRAG_TYPE) === true) {
          const after = isLowerHalf(row, event);
          row.classList.toggle("drop-before", !after);
          row.classList.toggle("drop-after", after);
        }
      });
      row.addEventListener("dragleave", () => { row.classList.remove("drop-before", "drop-after"); });
      row.addEventListener("drop", (event) => {
        event.preventDefault();
        event.stopPropagation();
        card.classList.remove("over");
        const after = isLowerHalf(row, event);
        row.classList.remove("drop-before", "drop-after");
        this.dropInto(collection, event, after ? index + 1 : index);
      });
      const remove = button(() => {
        this.run(() => this.change(this.book.removePage(collection.id, index)));
      }, "button", "icon remove");
      remove.append(icon("close"));
      remove.title = "Remove this link";
      row.append(favicon(page), ...this.pageTitle(collection, page, index), remove);
      list.append(row);
    });
    card.append(list);
    return card;
  }

  /** Puts the dragged page into the collection at `to` (undefined: the end); a tab is added, a saved link is moved. */
  private dropInto(collection: Collection, event: DragEvent, to: number | undefined): void {
    const raw = event.dataTransfer?.getData(DRAG_TYPE) ?? "";
    if (raw === "") {
      return;
    }
    const { page, from } = JSON.parse(raw) as DragPayload;
    this.justAdded = { collectionId: collection.id, url: page.url };
    this.run(() => this.change(this.placed(collection.id, page, from, to)));
  }

  private placed(collectionId: string, page: SavedPage, from: PageRef | undefined, to: number | undefined): CollectionBook {
    if (from !== undefined) {
      return this.book.movePage(from.collectionId, from.index, collectionId, to);
    }
    const added = this.book.addPage(collectionId, page);
    return to === undefined ? added : added.reorderPage(collectionId, added.get(collectionId).pages.length - 1, to);
  }

  /** The link with its host line and pen button, or a title + url form while it is being edited. */
  private pageTitle(collection: Collection, page: SavedPage, index: number): HTMLElement[] {
    const editing = this.editingPage;
    if (editing?.collectionId !== collection.id || editing.index !== index) {
      const body = el("span", "text");
      const link = el("a") as HTMLAnchorElement;
      link.href = page.url;
      link.replaceChildren(...marked(page.title, this.query));
      link.title = page.url;
      link.addEventListener("click", (event) => {
        event.preventDefault();
        this.run(() => this.browser.jumpTo(page.url));
      });
      const host = el("span", "host");
      host.replaceChildren(...marked(hostnameOf(page.url), this.query));
      body.append(link, host);
      const edit = button(() => {
        this.editingPage = { collectionId: collection.id, index };
        this.renderCollections();
        focusAndSelect(this.root.querySelector<HTMLInputElement>(".page input.title"));
      }, "button", "icon edit");
      edit.append(icon("pen"));
      edit.title = "Edit the title and the url";
      return [body, edit];
    }
    const form = el("form", "edit") as HTMLFormElement;
    const title = el("input", "title") as HTMLInputElement;
    title.type = "text";
    title.value = page.title;
    title.placeholder = "Title";
    const url = el("input", "url") as HTMLInputElement;
    url.type = "text";
    url.value = page.url;
    url.placeholder = "https://";
    url.spellcheck = false;
    form.append(title, url);
    const save = (): void => {
      this.editingPage = undefined;
      this.run(() => this.change(this.book.editPage(collection.id, index, title.value, url.value)));
    };
    const cancel = (): void => {
      this.editingPage = undefined;
      this.renderCollections();
    };
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      save();
    });
    form.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        cancel();
      }
    });
    // leaving the form (not moving between its two fields) saves, like the single-field editors
    form.addEventListener("focusout", (event) => {
      if (this.editingPage !== undefined && !form.contains(event.relatedTarget as Node | null)) {
        save();
      }
    });
    return [form];
  }

  /** The collection name and its pen button, or an input while it is being renamed. */
  private nameField(collection: Collection): HTMLElement[] {
    if (this.renaming !== collection.id) {
      const name = el("span", "name");
      name.replaceChildren(...marked(collection.name, this.query));
      const edit = button(() => {
        this.renaming = collection.id;
        this.renderCollections();
        focusAndSelect(this.root.querySelector<HTMLInputElement>(".card input.name"));
      }, "button", "icon edit");
      edit.append(icon("pen"));
      edit.title = "Rename this collection";
      return [name, edit];
    }
    const input = el("input", "name") as HTMLInputElement;
    input.type = "text";
    input.value = collection.name;
    this.editOnKeys(input, () => {
      this.renaming = undefined;
      this.run(() => this.change(this.book.rename(collection.id, input.value)));
    }, () => {
      this.renaming = undefined;
      this.renderCollections();
    }, () => this.renaming === collection.id);
    return [input];
  }

  /** Enter or leaving the field saves, Escape cancels; `stillEditing` guards the blur after a cancel. */
  private editOnKeys(input: HTMLInputElement, save: () => void, cancel: () => void, stillEditing: () => boolean): void {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        save();
      } else if (event.key === "Escape") {
        cancel();
      }
    });
    input.addEventListener("blur", () => {
      if (stillEditing()) {
        save();
      }
    });
  }

  /** A trash icon, shown on hover; deleting asks first. */
  private deleteButton(collection: Collection): HTMLElement {
    const trash = button(() => {
      const count = collection.pages.length;
      const question = `Delete the collection "${collection.name}" with ${String(count)} ${count === 1 ? "link" : "links"}?`;
      if (window.confirm(question)) {
        this.run(() => this.change(this.book.remove(collection.id)));
      }
    }, "button", "icon trash");
    trash.append(icon("trash"));
    trash.title = "Delete this collection";
    return trash;
  }

  // ---- state changes ----------------------------------------------------------------------

  private async change(next: CollectionBook): Promise<void> {
    this.book = next;
    await this.persistence.save(this.book.toData());
  }

  /** Runs an action, then re-renders (by default everything); a failure shows in the notice strip. */
  private run(action: () => Promise<void>, rerender: () => void = () => { this.render(); }): void {
    action().then(
      () => { rerender(); },
      (error: unknown) => {
        rerender();
        const notice = this.must(".notice");
        notice.textContent = error instanceof Error ? error.message : String(error);
        notice.removeAttribute("hidden");
      },
    );
  }
}

// ---- DOM helpers ----------------------------------------------------------------------------

function startDrag(event: DragEvent, row: HTMLElement, payload: DragPayload): void {
  if (event.dataTransfer === null) {
    return;
  }
  event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
  event.dataTransfer.effectAllowed = payload.from === undefined ? "copy" : "move";
  // the class goes on after the browser took its drag image, so the ghost is the full row
  setTimeout(() => { row.classList.add("dragging"); }, 0);
}

/** Whether the pointer is in the lower half of the row: the drop goes after it. */
function isLowerHalf(row: HTMLElement, event: DragEvent): boolean {
  const box = row.getBoundingClientRect();
  return event.clientY - box.top > box.height / 2;
}

function focusAndSelect(input: HTMLInputElement | null): void {
  input?.focus();
  input?.select();
}

/** The text with its first match of the query wrapped in <mark>; the plain text when there is none. */
function marked(content: string, query: string): (string | HTMLElement)[] {
  const match = findMatch(content, query);
  if (match === undefined) {
    return [content];
  }
  const mark = el("mark");
  mark.textContent = match.match;
  return [match.before, mark, match.after];
}

/** The page's favicon, or a lettered tile coloured by its host when it has none. */
function favicon(page: SavedPage): HTMLElement {
  if (page.favIconUrl !== undefined) {
    const img = el("img", "favicon") as HTMLImageElement;
    img.src = page.favIconUrl;
    img.alt = "";
    img.addEventListener("error", () => { img.replaceWith(letterTile(page.url)); });
    return img;
  }
  return letterTile(page.url);
}

function letterTile(url: string): HTMLElement {
  const tile = el("span", "favicon letter");
  tile.textContent = initialOf(url);
  tile.style.setProperty("--h", String(hueOf(hostnameOf(url))));
  return tile;
}

function icon(name: keyof typeof ICONS): SVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = ICONS[name];
  return svg;
}

function text(content: string): Text {
  return document.createTextNode(content);
}

function el(tag: string, className?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className !== undefined) {
    node.className = className;
  }
  return node;
}

function button(onClick?: () => void, type: "button" | "submit" = "button", className?: string): HTMLButtonElement {
  const node = el("button", className) as HTMLButtonElement;
  node.type = type;
  if (onClick !== undefined) {
    node.addEventListener("click", onClick);
  }
  return node;
}

// ---- boot -----------------------------------------------------------------------------------

const app = document.getElementById("app");
if (app === null) {
  throw new Error("tabs.html has no #app element");
}
const page = new TabsPage(
  app,
  chrome.runtime.getURL("tabs.html"),
  new LocalPersistence(chrome.storage.local, chrome.storage.onChanged),
  new ThemeStore(chrome.storage.local),
  new ChromeTabBrowser(),
  new SystemClock(),
  new RandomIdSource(),
);
page.start().catch((error: unknown) => {
  app.textContent = `Tabuzaur could not load its data: ${error instanceof Error ? error.message : String(error)}`;
});
