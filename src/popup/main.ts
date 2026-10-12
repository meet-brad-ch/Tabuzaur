import { CollectionBook } from "../lib/collections.ts";
import type { Clock, Collection, IdSource } from "../lib/model.ts";
import { RandomIdSource, SystemClock } from "../lib/model.ts";
import type { Persistence } from "../lib/storage.ts";
import { LocalPersistence } from "../lib/storage.ts";
import type { OpenTab, TabBrowser } from "../lib/tabs.ts";
import { ChromeTabBrowser } from "../lib/tabs.ts";

type SaveMode = "keep" | "close";

/** The popup: renders the book into the root element and routes clicks to the book and the browser. */
class Popup {
  private book = CollectionBook.empty();
  private query = "";
  private pendingSave: SaveMode | undefined;
  private pendingDelete: string | undefined;

  constructor(
    private readonly root: HTMLElement,
    private readonly persistence: Persistence,
    private readonly browser: TabBrowser,
    private readonly clock: Clock,
    private readonly ids: IdSource,
  ) {}

  async start(): Promise<void> {
    const data = await this.persistence.load();
    this.book = data === undefined ? CollectionBook.empty() : CollectionBook.fromData(data);
    this.render();
  }

  private render(): void {
    this.root.replaceChildren(this.toolbar(), this.saveForm(), this.list());
  }

  private toolbar(): HTMLElement {
    const bar = el("div", "toolbar");
    const search = el("input", "search") as HTMLInputElement;
    search.type = "search";
    search.placeholder = "Search collections";
    search.value = this.query;
    search.addEventListener("input", () => {
      this.query = search.value;
      this.renderList();
    });
    bar.append(
      search,
      button("Save window", () => { this.showSaveForm("keep"); }),
      button("Save & close", () => { this.showSaveForm("close"); }),
    );
    return bar;
  }

  private showSaveForm(mode: SaveMode): void {
    this.pendingSave = mode;
    this.render();
    const input = this.root.querySelector<HTMLInputElement>(".save-form input");
    input?.focus();
    input?.select();
  }

  private saveForm(): HTMLElement {
    const form = el("form", "save-form") as HTMLFormElement;
    if (this.pendingSave === undefined) {
      form.hidden = true;
      return form;
    }
    const mode = this.pendingSave;
    const input = el("input") as HTMLInputElement;
    input.type = "text";
    input.value = `Window ${this.clock.now().toLocaleString()}`;
    input.required = true;
    form.append(input, button(mode === "close" ? "Save & close tabs" : "Save", undefined, "submit"));
    form.append(button("Cancel", () => { this.pendingSave = undefined; this.render(); }));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.run(() => this.save(input.value, mode));
    });
    return form;
  }

  private async save(name: string, mode: SaveMode): Promise<void> {
    const tabs: readonly OpenTab[] = await this.browser.currentWindowTabs();
    this.book = this.book.add(name, tabs.map(({ title, url, favIconUrl }) =>
      favIconUrl === undefined ? { title, url } : { title, url, favIconUrl }), this.clock, this.ids);
    await this.persistence.save(this.book.toData());
    this.pendingSave = undefined;
    if (mode === "close") {
      await this.browser.close(tabs);
    }
  }

  private list(): HTMLElement {
    const list = el("section", "collections");
    this.fillList(list);
    return list;
  }

  private renderList(): void {
    const list = this.root.querySelector<HTMLElement>(".collections");
    if (list === null) {
      throw new Error("the collection list is not rendered");
    }
    this.fillList(list);
  }

  private fillList(list: HTMLElement): void {
    const shown = this.book.search(this.query);
    if (shown.length === 0) {
      const empty = el("p", "empty");
      empty.textContent = this.book.collections.length === 0 ? "No collections yet. Save this window to start." : "Nothing matches.";
      list.replaceChildren(empty);
      return;
    }
    list.replaceChildren(...shown.map((c) => this.collectionItem(c)));
  }

  private collectionItem(collection: Collection): HTMLElement {
    const item = el("details", "collection") as HTMLDetailsElement;
    const summary = el("summary");
    const name = el("span", "name");
    name.textContent = collection.name;
    const meta = el("span", "meta");
    meta.textContent = `${String(collection.tabs.length)} tabs · ${new Date(collection.createdAt).toLocaleDateString()}`;
    const actions = el("span", "actions");
    actions.addEventListener("click", (event) => { event.preventDefault(); });
    actions.append(
      button("Open", () => { this.run(() => this.browser.openInNewWindow(collection.tabs.map((t) => t.url))); }),
      this.pendingDelete === collection.id
        ? button("Confirm delete", () => { this.run(() => this.change(this.book.remove(collection.id))); }, undefined, "danger")
        : button("Delete", () => { this.pendingDelete = collection.id; this.render(); }),
    );
    summary.append(name, meta, actions);
    const tabs = el("ul", "tabs");
    collection.tabs.forEach((tab, index) => {
      const row = el("li");
      const link = el("a") as HTMLAnchorElement;
      link.href = tab.url;
      link.target = "_blank";
      link.textContent = tab.title;
      link.title = tab.url;
      row.append(link, button("×", () => { this.run(() => this.change(this.book.removeTab(collection.id, index))); }, undefined, "remove"));
      tabs.append(row);
    });
    item.append(summary, tabs);
    return item;
  }

  private async change(next: CollectionBook): Promise<void> {
    this.book = next;
    this.pendingDelete = undefined;
    await this.persistence.save(this.book.toData());
  }

  /** Runs an action, re-renders, and shows a failure in the popup instead of losing it in the console. */
  private run(action: () => Promise<void>): void {
    action().then(
      () => { this.render(); },
      (error: unknown) => {
        this.render();
        const message = el("p", "error");
        message.textContent = error instanceof Error ? error.message : String(error);
        this.root.prepend(message);
      },
    );
  }
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
  throw new Error("popup.html has no #app element");
}
const popup = new Popup(app, new LocalPersistence(chrome.storage.local), new ChromeTabBrowser(), new SystemClock(), new RandomIdSource());
popup.start().catch((error: unknown) => {
  app.textContent = `Tabuzaur could not load its data: ${error instanceof Error ? error.message : String(error)}`;
});
