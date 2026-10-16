import { edgeScrollStep } from "../lib/autoscroll.ts";
import { backupFileName, parseBackup, serializeBackup } from "../lib/backup.ts";
import { CollectionBook, findMatch } from "../lib/collections.ts";
import type { Clock, Collection, IdSource, SavedPage } from "../lib/model.ts";
import { HUE_COUNT, RandomIdSource, SystemClock } from "../lib/model.ts";
import type { Persistence, Theme } from "../lib/storage.ts";
import { FlagStore, LocalPersistence, OPEN_IN_NEW_TAB_KEY, SIDEBAR_PINNED_KEY, THEMES, ThemeStore } from "../lib/storage.ts";
import type { OpenTab, TabBrowser } from "../lib/tabs.ts";
import { ChromeTabBrowser } from "../lib/tabs.ts";
import { hostnameOf, hueOf, initialOf } from "../lib/urls.ts";

const DRAG_TYPE = "application/x-tabuzaur-page";
const CARD_DRAG_TYPE = "application/x-tabuzaur-collection";
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
  pin: '<path d="M12 17v5"/><path d="M9 3h6l-1 7 3 3H7l3-3z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 19h16"/>',
  upload: '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M4 19h16"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5"/><path d="M12 17h.01"/>',
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
  private pinned = false;
  private openInNewTab = false;
  private shortcut = "";
  private renaming: string | undefined;
  private editingPage: PageRef | undefined;
  private justAdded: { collectionId: string; url: string } | undefined;
  private pendingNotice: string | undefined;
  private readonly collapsed = new Set<number>();
  private readonly darkSystem = window.matchMedia("(prefers-color-scheme: dark)");

  constructor(
    private readonly root: HTMLElement,
    private readonly ownUrl: string,
    private readonly persistence: Persistence,
    private readonly themes: ThemeStore,
    private readonly sidebarPinned: FlagStore,
    private readonly newTabFlag: FlagStore,
    private readonly browser: TabBrowser,
    private readonly clock: Clock,
    private readonly ids: IdSource,
  ) {}

  async start(): Promise<void> {
    this.theme = await this.themes.load();
    this.pinned = await this.sidebarPinned.load();
    this.openInNewTab = await this.newTabFlag.load();
    this.applyTheme();
    this.darkSystem.addEventListener("change", () => { this.applyTheme(); });
    await this.loadBook();
    this.ownWindowId = await this.browser.currentWindowId();
    this.openTabs = await this.browser.openTabs();
    this.shortcut = await this.browser.actionShortcut();
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
    const loaded = data === undefined ? CollectionBook.empty() : CollectionBook.fromData(data);
    this.book = loaded.assignHues();
    if (this.book !== loaded) {
      await this.persistence.save(this.book.toData());  // a pre-0.3.0 document: colors are stamped once
    }
  }

  /** Resolves "system" to the OS choice, so the stylesheet only knows light and dark. */
  private applyTheme(): void {
    const effective = this.theme === "system" ? (this.darkSystem.matches ? "dark" : "light") : this.theme;
    document.documentElement.dataset.theme = effective;
  }

  // ---- rendering --------------------------------------------------------------------------

  private render(): void {
    // the page is rebuilt from scratch: the two scrolling areas keep their position, or the drop
    // of a link into a collection below the fold would throw the viewer back to the top
    const mainTop = this.root.querySelector("main")?.scrollTop ?? 0;
    const asideTop = this.root.querySelector("aside")?.scrollTop ?? 0;
    this.root.replaceChildren(this.header(), el("p", "notice"), this.layout());
    this.must("main").scrollTop = mainTop;
    this.must("aside").scrollTop = asideTop;
    if (this.pendingNotice === undefined) {
      this.must(".notice").setAttribute("hidden", "");
    } else {
      this.notify(this.pendingNotice, "info");
      this.pendingNotice = undefined;
    }
  }

  private notify(message: string, kind: "info" | "error"): void {
    const notice = this.must(".notice");
    notice.textContent = message;
    notice.className = `notice ${kind}`;
    notice.removeAttribute("hidden");
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
    brand.append(logo, words, this.shortcutBadge());

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

    // the tools wrap as one group under the brand and the search when the window is narrow
    const tools = el("div", "tools");
    const icons = el("div", "icons");
    icons.append(this.themeButton(), this.settingsButton(), this.helpButton());
    tools.append(form, this.backupButtons(), icons);
    header.append(brand, search, tools);
    return header;
  }

  private settingsButton(): HTMLElement {
    const gear = button(() => { this.openSettings(); }, "button", "icon settings");
    gear.append(icon("gear"));
    labelled(gear, "Settings");
    return gear;
  }

  /** The settings dialog: one option so far, off by default. */
  private openSettings(): void {
    const dialog = el("dialog", "settings") as HTMLDialogElement;
    const heading = el("h3");
    heading.textContent = "Settings";
    const option = el("label", "option");
    const box = el("input") as HTMLInputElement;
    box.type = "checkbox";
    box.checked = this.openInNewTab;
    const words = el("span");
    const name = el("strong");
    name.textContent = "Open Tabuzaur in every new tab";
    const note = el("span", "note");
    note.textContent = "A new blank tab (Ctrl+T or the + button) shows the Tabuzaur page instead of Chrome's new-tab page. Tabs opened on an address are not affected.";
    words.append(name, note);
    option.append(box, words);
    box.addEventListener("change", () => {
      this.run(async () => {
        await this.newTabFlag.save(box.checked);
        this.openInNewTab = box.checked;
      }, () => undefined);
    });
    const actions = el("div", "actions");
    actions.append(button(() => { dialog.close(); dialog.remove(); }, "button", "primary", "Close"));
    dialog.append(heading, option, actions);
    dialog.addEventListener("cancel", () => { dialog.remove(); });
    document.body.append(dialog);
    dialog.showModal();
  }

  private helpButton(): HTMLElement {
    const help = button(() => {
      this.run(() => this.browser.jumpTo(new URL("help.html", location.href).href));
    }, "button", "icon help");
    help.append(icon("help"));
    labelled(help, "Help: how to install and use Tabuzaur");
    return help;
  }

  /** Export downloads the document as JSON; import reads such a file and asks: replace or merge. */
  private backupButtons(): HTMLElement {
    const group = el("div", "backup");
    const exportButton = button(() => {
      const now = this.clock.now();
      download(backupFileName(now), serializeBackup(this.book.toData(), now));
    }, "button", "ghost");
    exportButton.append(icon("download"), text("Export"));
    const picker = el("input") as HTMLInputElement;
    picker.type = "file";
    picker.accept = ".json,application/json";
    picker.hidden = true;
    picker.addEventListener("change", () => {
      const file = picker.files?.[0];
      picker.value = "";
      if (file === undefined) {
        return;
      }
      this.run(async () => {
        const data = parseBackup(await file.text());
        const choice = await this.askImport(file.name, data.collections.length);
        if (choice === "cancel") {
          return;
        }
        await this.change(choice === "replace" ? CollectionBook.fromData(data) : this.book.merge(data));
        const count = data.collections.length;
        this.pendingNotice = `${choice === "replace" ? "Replaced with" : "Merged"} ${String(count)} ${count === 1 ? "collection" : "collections"} from ${file.name}.`;
      });
    });
    const importButton = button(() => { picker.click(); }, "button", "ghost");
    importButton.append(icon("upload"), text("Import"));
    group.append(exportButton, importButton, picker);
    return group;
  }

  /** A modal with the three ways to take an import; resolves with the one chosen. */
  private askImport(fileName: string, count: number): Promise<"replace" | "merge" | "cancel"> {
    const dialog = el("dialog", "import") as HTMLDialogElement;
    const heading = el("h3");
    heading.textContent = `Import ${String(count)} ${count === 1 ? "collection" : "collections"} from ${fileName}`;
    const current = this.book.collections.length;
    const replaceText = el("p");
    replaceText.textContent = `Replace: the ${String(current)} ${current === 1 ? "collection" : "collections"} you have now ${current === 1 ? "is" : "are"} removed first.`;
    const mergeText = el("p");
    mergeText.textContent = "Merge: imported collections join yours by name, links you already have are kept, nothing is removed.";
    const actions = el("div", "actions");
    dialog.append(heading, replaceText, mergeText, actions);
    return new Promise((resolve) => {
      const choose = (choice: "replace" | "merge" | "cancel"): void => {
        dialog.close();
        dialog.remove();
        resolve(choice);
      };
      actions.append(
        button(() => { choose("replace"); }, "button", "danger-outline", "Replace"),
        button(() => { choose("merge"); }, "button", "primary", "Merge"),
        button(() => { choose("cancel"); }, "button", "ghost", "Cancel"),
      );
      dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        choose("cancel");
      });
      document.body.append(dialog);
      dialog.showModal();
    });
  }

  /** The assigned key, or, when Chrome assigned none, a link to its shortcut settings. */
  private shortcutBadge(): HTMLElement {
    if (this.shortcut !== "") {
      const key = el("kbd", "shortcut");
      key.textContent = this.shortcut;
      key.title = "Opens Tabuzaur from any tab";
      return key;
    }
    const hint = button(() => {
      this.run(() => this.browser.openInNewTab("chrome://extensions/shortcuts"));
    }, "button", "shortcut unset");
    hint.textContent = "No shortcut assigned - set one";
    labelled(hint, "Chrome assigns Alt+T only when no other extension uses it; pick a key on chrome://extensions/shortcuts");
    return hint;
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
    labelled(toggle, `${labels[this.theme]} (click to change)`);
    return toggle;
  }

  /** Pinned: a two-column grid. Unpinned: the sidebar is a flyout over the collections, opened by hovering the rail. */
  private layout(): HTMLElement {
    const layout = el("div", this.pinned ? "layout pinned" : "layout");
    const rail = el("div", "rail");
    const aside = el("aside");
    const main = el("main");
    layout.append(rail, aside, main);
    new DragScroller(main, layout);
    this.fillSidebar(aside);
    this.fillRail(rail);
    this.fillCollections(main);
    return layout;
  }

  private fillRail(rail: HTMLElement): void {
    const count = this.openTabs.filter((t) => t.url !== this.ownUrl).length;
    const label = el("span", "label");
    label.textContent = "Open tabs";
    const badge = el("span", "count");
    badge.textContent = String(count);
    rail.replaceChildren(badge, label);
    rail.title = "Rest the pointer here to see the open tabs";
  }

  private pinButton(): HTMLElement {
    const pin = button(() => {
      this.run(async () => {
        this.pinned = !this.pinned;
        await this.sidebarPinned.save(this.pinned);
      });
    }, "button", this.pinned ? "icon pin on" : "icon pin");
    pin.append(icon("pin"));
    labelled(pin, this.pinned ? "Unpin: the panel slides in on hover" : "Pin the panel open");
    return pin;
  }

  private renderSidebar(): void {
    this.fillSidebar(this.must("aside"));
    this.fillRail(this.must(".rail"));
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
    const titleRow = el("div", "title-row");
    const heading = el("h2");
    heading.textContent = "Open tabs";
    titleRow.append(heading, this.pinButton());
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
    head.append(titleRow, filter);
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
      // No mouse events arrive during a native drag, so :hover would keep the flyout open over
      // the collections. Fold it away (after the drag image is taken) until the drag ends.
      setTimeout(() => { this.must(".layout").classList.add("dragging-out"); }, 0);
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      this.must(".layout").classList.remove("dragging-out");
    });
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
    cards.append(...shown.map((c) => this.card(c, c.hue ?? this.book.collections.indexOf(c) % HUE_COUNT)));
    main.append(cards);
    this.justAdded = undefined;
  }

  private card(collection: Collection, hue: number): HTMLElement {
    const card = el("section", `card hue-${String(hue)}`);
    card.addEventListener("dragover", (event) => {
      const transfer = event.dataTransfer;
      if (transfer === null) {
        return;
      }
      if (transfer.types.includes(CARD_DRAG_TYPE)) {
        event.preventDefault();
        transfer.dropEffect = "move";
        const after = isLowerHalf(card, event);
        card.classList.toggle("insert-before", !after);
        card.classList.toggle("insert-after", after);
      } else if (transfer.types.includes(DRAG_TYPE)) {
        event.preventDefault();
        transfer.dropEffect = transfer.effectAllowed === "move" ? "move" : "copy";
        card.classList.add("over");
      }
    });
    card.addEventListener("dragleave", (event) => {
      if (!card.contains(event.relatedTarget as Node | null)) {
        card.classList.remove("over", "insert-before", "insert-after");
      }
    });
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      card.classList.remove("over", "insert-before", "insert-after");
      const movedId = event.dataTransfer?.getData(CARD_DRAG_TYPE) ?? "";
      if (movedId !== "") {
        const place = this.book.collections.indexOf(collection) + (isLowerHalf(card, event) ? 1 : 0);
        this.run(() => this.change(this.book.reorderCollection(movedId, place)));
        return;
      }
      this.dropInto(collection, event, undefined);
    });

    const header = el("header");
    header.append(...this.nameField(collection), this.deleteButton(collection));
    header.draggable = this.renaming !== collection.id;
    header.title = header.draggable ? "Drag to move this collection" : "";
    header.addEventListener("dragstart", (event) => {
      if (event.dataTransfer === null) {
        return;
      }
      event.dataTransfer.setData(CARD_DRAG_TYPE, collection.id);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setDragImage(card, 24, 20);
      setTimeout(() => { card.classList.add("dragging"); }, 0);
    });
    header.addEventListener("dragend", () => { card.classList.remove("dragging"); });
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
        if (event.dataTransfer?.types.includes(DRAG_TYPE) !== true) {
          return;
        }
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
      labelled(remove, "Remove this link");
      const { body, edit } = this.pageTitle(collection, page, index);
      row.append(favicon(page), body);
      if (edit !== undefined) {
        const actions = el("span", "actions");
        actions.append(edit, remove);
        row.append(actions);
      }
      // the whole row follows the link; the buttons and the editor are exempt
      row.addEventListener("click", (event) => {
        if ((event.target as Element).closest("button, form, input") !== null) {
          return;
        }
        this.run(() => this.browser.jumpTo(page.url));
      });
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
  private pageTitle(collection: Collection, page: SavedPage, index: number): { body: HTMLElement; edit: HTMLElement | undefined } {
    const editing = this.editingPage;
    if (editing?.collectionId !== collection.id || editing.index !== index) {
      const body = el("span", "text");
      const link = el("a") as HTMLAnchorElement;
      link.href = page.url;
      link.replaceChildren(...marked(page.title, this.query));
      link.title = page.url;
      link.addEventListener("click", (event) => { event.preventDefault(); });  // the row handles it
      const host = el("span", "host");
      host.replaceChildren(...marked(hostnameOf(page.url), this.query));
      body.append(link, host);
      const edit = button(() => {
        this.editingPage = { collectionId: collection.id, index };
        this.renderCollections();
        focusAndSelect(this.root.querySelector<HTMLInputElement>(".page input.title"));
      }, "button", "icon edit");
      edit.append(icon("pen"));
      labelled(edit, "Edit the title and the url");
      return { body, edit };
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
    // Two text fields and no submit button: the form never submits on Enter by itself
    // (HTML implicit submission), so both keys are handled here.
    form.addEventListener("submit", (event) => { event.preventDefault(); });
    form.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        save();
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      }
    });
    // leaving the form (not moving between its two fields) saves, like the single-field editors
    form.addEventListener("focusout", (event) => {
      if (this.editingPage !== undefined && !form.contains(event.relatedTarget as Node | null)) {
        save();
      }
    });
    return { body: form, edit: undefined };
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
      labelled(edit, "Rename this collection");
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
    labelled(trash, "Delete this collection");
    return trash;
  }

  // ---- state changes ----------------------------------------------------------------------

  private async change(next: CollectionBook): Promise<void> {
    this.book = next.assignHues();  // an imported document may lack colors
    await this.persistence.save(this.book.toData());
  }

  /** Runs an action, then re-renders (by default everything); a failure shows in the notice strip. */
  private run(action: () => Promise<void>, rerender: () => void = () => { this.render(); }): void {
    action().then(
      () => { rerender(); },
      (error: unknown) => {
        rerender();
        this.notify(error instanceof Error ? error.message : String(error), "error");
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

/** Whether the pointer is in the lower half of the element: the drop goes after it. */
function isLowerHalf(row: HTMLElement, event: DragEvent): boolean {
  const box = row.getBoundingClientRect();
  return event.clientY - box.top > box.height / 2;
}

/**
 * Scrolls the collections while a drag rests near their top or bottom edge, so a collection
 * below the fold can take the drop. The wheel does not reach the page during a native drag, and
 * Chrome's own drag autoscroll only acts in a 20px belt after a delay, which is easy to miss.
 * Each dragover over the area records the pointer; a frame loop scrolls by the edge step until
 * the drag ends, drops, or the dragover events stop (the pointer left the area).
 */
class DragScroller {
  private pointerY = Number.NaN;
  private lastOver = 0;
  private frame = 0;

  constructor(private readonly area: HTMLElement, sources: HTMLElement) {
    area.addEventListener("dragover", (event) => {
      this.pointerY = event.clientY;
      this.lastOver = performance.now();
      if (this.frame === 0) {
        this.frame = requestAnimationFrame(this.tick);
      }
    });
    area.addEventListener("drop", () => { this.stop(); });
    sources.addEventListener("dragend", () => { this.stop(); });
  }

  private readonly tick = (now: number): void => {
    this.frame = 0;
    if (now - this.lastOver > DRAG_OVER_SILENCE_MS) {
      return;
    }
    const box = this.area.getBoundingClientRect();
    const step = edgeScrollStep(this.pointerY, box.top, box.bottom);
    if (step !== 0) {
      this.area.scrollTop += step;
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  private stop(): void {
    if (this.frame !== 0) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
  }
}

/** Chrome repeats dragover at least every 350ms while the pointer rests; longer silence means it left the area. */
const DRAG_OVER_SILENCE_MS = 500;


/** Hands the viewer a text file to save. */
function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = el("a") as HTMLAnchorElement;
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => { URL.revokeObjectURL(url); }, 1000);
}

/** A tooltip for the pointer and the same text for a screen reader, on a button that shows only an icon. */
function labelled(node: HTMLElement, label: string): void {
  node.title = label;
  node.setAttribute("aria-label", label);
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

function button(onClick?: () => void, type: "button" | "submit" = "button", className?: string, label?: string): HTMLButtonElement {
  const node = el("button", className) as HTMLButtonElement;
  node.type = type;
  if (label !== undefined) {
    node.textContent = label;
  }
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
  new FlagStore(chrome.storage.local, SIDEBAR_PINNED_KEY),
  new FlagStore(chrome.storage.local, OPEN_IN_NEW_TAB_KEY),
  new ChromeTabBrowser(),
  new SystemClock(),
  new RandomIdSource(),
);
page.start().catch((error: unknown) => {
  app.textContent = `Tabuzaur could not load its data: ${error instanceof Error ? error.message : String(error)}`;
});
