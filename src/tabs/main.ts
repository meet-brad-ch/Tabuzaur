import { CollectionBook } from "../lib/collections.ts";
import type { Clock, Collection, IdSource, SavedPage } from "../lib/model.ts";
import { RandomIdSource, SystemClock } from "../lib/model.ts";
import type { Persistence } from "../lib/storage.ts";
import { LocalPersistence } from "../lib/storage.ts";
import type { OpenTab, TabBrowser } from "../lib/tabs.ts";
import { ChromeTabBrowser } from "../lib/tabs.ts";

const DRAG_TYPE = "application/x-tabuzaur-page";

/** Pastel hues for the cards, cycled by position: rose, peach, lemon, mint, aqua, sky, lavender, pink. */
const CARD_HUES: readonly number[] = [0, 30, 55, 120, 170, 210, 260, 320];

/** What a drag carries: a page, and where it comes from when it is already in a collection. */
interface DragPayload {
  readonly page: SavedPage;
  readonly from?: { readonly collectionId: string; readonly index: number };
}

function startDrag(event: DragEvent, payload: DragPayload): void {
  if (event.dataTransfer === null) {
    return;
  }
  event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
  event.dataTransfer.effectAllowed = payload.from === undefined ? "copy" : "move";
}

/** The Tabuzaur page: open tabs on the left, collections on the right, drag from left to right. */
class TabsPage {
  private book = CollectionBook.empty();
  private openTabs: readonly OpenTab[] = [];
  private ownWindowId = -1;
  private query = "";
  private renaming: string | undefined;
  private editingPage: { collectionId: string; index: number } | undefined;

  constructor(
    private readonly root: HTMLElement,
    private readonly ownUrl: string,
    private readonly persistence: Persistence,
    private readonly browser: TabBrowser,
    private readonly clock: Clock,
    private readonly ids: IdSource,
  ) {}

  async start(): Promise<void> {
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

  private render(): void {
    this.root.replaceChildren(this.header(), el("p", "notice"), this.layout());
    this.root.querySelector<HTMLElement>(".notice")?.setAttribute("hidden", "");
  }

  private header(): HTMLElement {
    const header = el("header");
    const title = el("h1");
    title.textContent = "Tabuzaur";
    const search = el("input", "search") as HTMLInputElement;
    search.type = "search";
    search.placeholder = "Search collections and pages";
    search.value = this.query;
    search.addEventListener("input", () => {
      this.query = search.value;
      this.renderCollections();
    });
    const form = el("form") as HTMLFormElement;
    const name = el("input") as HTMLInputElement;
    name.type = "text";
    name.placeholder = "New collection";
    name.required = true;
    form.append(name, button("Create", undefined, "submit"));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.run(() => this.change(this.book.create(name.value, this.clock, this.ids)));
    });
    header.append(title, search, form);
    return header;
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

  private fillSidebar(aside: HTMLElement): void {
    const heading = el("h2");
    heading.textContent = "Open tabs";
    aside.replaceChildren(heading);
    const tabs = this.openTabs.filter((t) => t.url !== this.ownUrl);
    const windowIds = [...new Set(tabs.map((t) => t.windowId))].sort(
      (a, b) => Number(b === this.ownWindowId) - Number(a === this.ownWindowId) || a - b,
    );
    for (const windowId of windowIds) {
      const label = el("h3");
      label.textContent = windowId === this.ownWindowId ? "This window" : `Window ${String(windowId)}`;
      const list = el("ul");
      list.append(...tabs.filter((t) => t.windowId === windowId).map((t) => this.tabRow(t)));
      aside.append(label, list);
    }
    if (tabs.length === 0) {
      const empty = el("p", "empty");
      empty.textContent = "No other tabs are open.";
      aside.append(empty);
    }
  }

  private tabRow(tab: OpenTab): HTMLElement {
    const row = el("li", tab.active ? "tab active" : "tab");
    row.draggable = true;
    row.title = tab.url;
    const title = el("span", "title");
    title.textContent = tab.title;
    row.append(favicon(tab), title);
    row.addEventListener("click", () => { this.run(() => this.browser.activate(tab)); });
    row.addEventListener("dragstart", (event) => {
      const page: SavedPage = tab.favIconUrl === undefined
        ? { title: tab.title, url: tab.url }
        : { title: tab.title, url: tab.url, favIconUrl: tab.favIconUrl };
      startDrag(event, { page });
    });
    return row;
  }

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
    cards.append(...shown.map((c, i) => this.card(c, CARD_HUES[i % CARD_HUES.length] ?? 0)));
    main.append(cards);
  }

  private card(collection: Collection, hue: number): HTMLElement {
    const card = el("section", "card");
    card.style.setProperty("--hue", String(hue));
    card.addEventListener("dragover", (event) => {
      if (event.dataTransfer?.types.includes(DRAG_TYPE) === true) {
        event.preventDefault();
        event.dataTransfer.dropEffect = event.dataTransfer.effectAllowed === "move" ? "move" : "copy";
        card.classList.add("over");
      }
    });
    card.addEventListener("dragleave", () => { card.classList.remove("over"); });
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      card.classList.remove("over");
      const raw = event.dataTransfer?.getData(DRAG_TYPE) ?? "";
      if (raw === "") {
        return;
      }
      const { page, from } = JSON.parse(raw) as DragPayload;
      this.run(() => this.change(from === undefined
        ? this.book.addPage(collection.id, page)
        : this.book.movePage(from.collectionId, from.index, collection.id)));
    });
    const header = el("header");
    header.append(...this.nameField(collection));
    const meta = el("span", "meta");
    meta.textContent = `${String(collection.pages.length)} pages`;
    header.append(meta, this.deleteButton(collection));
    card.append(header);
    if (collection.pages.length === 0) {
      const hint = el("p", "empty-hint");
      hint.textContent = "Drop tabs here";
      card.append(hint);
      return card;
    }
    const list = el("ul");
    collection.pages.forEach((page, index) => {
      const row = el("li", "page");
      row.draggable = true;
      row.addEventListener("dragstart", (event) => {
        startDrag(event, { page, from: { collectionId: collection.id, index } });
      });
      row.append(favicon(page), ...this.pageTitle(collection, page, index), button("×", () => {
        this.run(() => this.change(this.book.removePage(collection.id, index)));
      }, "button", "remove"));
      list.append(row);
    });
    card.append(list);
    return card;
  }

  /** The link and its edit button, or an input while the title is being edited. */
  private pageTitle(collection: Collection, page: SavedPage, index: number): HTMLElement[] {
    const editing = this.editingPage;
    if (editing?.collectionId !== collection.id || editing.index !== index) {
      const link = el("a") as HTMLAnchorElement;
      link.href = page.url;
      link.textContent = page.title;
      link.title = page.url;
      link.addEventListener("click", (event) => {
        event.preventDefault();
        this.run(() => this.browser.jumpTo(page.url));
      });
      const edit = button("✎", () => {
        this.editingPage = { collectionId: collection.id, index };
        this.renderCollections();
        const input = this.root.querySelector<HTMLInputElement>(".page input.title");
        input?.focus();
        input?.select();
      }, "button", "edit");
      edit.title = "Edit the title";
      return [link, edit];
    }
    const input = el("input", "title") as HTMLInputElement;
    input.type = "text";
    input.value = page.title;
    const finish = (): void => {
      this.editingPage = undefined;
      this.run(() => this.change(this.book.retitlePage(collection.id, index, input.value)));
    };
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        finish();
      } else if (event.key === "Escape") {
        this.editingPage = undefined;
        this.renderCollections();
      }
    });
    input.addEventListener("blur", () => {
      if (this.editingPage !== undefined) {
        finish();
      }
    });
    return [input];
  }

  /** The collection name and its pen button, or an input while it is being renamed. */
  private nameField(collection: Collection): HTMLElement[] {
    if (this.renaming !== collection.id) {
      const name = el("span", "name");
      name.textContent = collection.name;
      const edit = button("✎", () => {
        this.renaming = collection.id;
        this.renderCollections();
        const input = this.root.querySelector<HTMLInputElement>(".card input.name");
        input?.focus();
        input?.select();
      }, "button", "edit");
      edit.title = "Rename this collection";
      return [name, edit];
    }
    const input = el("input", "name") as HTMLInputElement;
    input.type = "text";
    input.value = collection.name;
    const finish = (): void => {
      this.renaming = undefined;
      this.run(() => this.change(this.book.rename(collection.id, input.value)));
    };
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        finish();
      } else if (event.key === "Escape") {
        this.renaming = undefined;
        this.renderCollections();
      }
    });
    input.addEventListener("blur", () => {
      if (this.renaming === collection.id) {
        finish();
      }
    });
    return [input];
  }

  /** A trash icon, shown on hover; deleting asks first. */
  private deleteButton(collection: Collection): HTMLElement {
    const trash = button("🗑", () => {
      const count = collection.pages.length;
      const question = `Delete the collection "${collection.name}" with ${String(count)} ${count === 1 ? "link" : "links"}?`;
      if (window.confirm(question)) {
        this.run(() => this.change(this.book.remove(collection.id)));
      }
    }, "button", "trash");
    trash.title = "Delete this collection";
    return trash;
  }

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

function favicon(page: SavedPage): HTMLElement {
  if (page.favIconUrl === undefined) {
    return el("span", "favicon");
  }
  const img = el("img", "favicon") as HTMLImageElement;
  img.src = page.favIconUrl;
  img.alt = "";
  return img;
}

function el(tag: string, className?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className !== undefined) {
    node.className = className;
  }
  return node;
}

function button(label: string, onClick?: () => void, type: "button" | "submit" = "button", className?: string): HTMLButtonElement {
  const node = el("button", className) as HTMLButtonElement;
  node.type = type;
  node.textContent = label;
  if (onClick !== undefined) {
    node.addEventListener("click", onClick);
  }
  return node;
}

const app = document.getElementById("app");
if (app === null) {
  throw new Error("tabs.html has no #app element");
}
const page = new TabsPage(
  app,
  chrome.runtime.getURL("tabs.html"),
  new LocalPersistence(chrome.storage.local, chrome.storage.onChanged),
  new ChromeTabBrowser(),
  new SystemClock(),
  new RandomIdSource(),
);
page.start().catch((error: unknown) => {
  app.textContent = `Tabuzaur could not load its data: ${error instanceof Error ? error.message : String(error)}`;
});
