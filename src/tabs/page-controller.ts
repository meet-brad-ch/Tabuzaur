import { BackupFile } from "../lib/backup.ts";
import { CollectionBook } from "../lib/collections.ts";
import type { Clock, IdSource } from "../lib/model.ts";
import type { CardSize, CardSizeStore, FlagStore, Persistence, ThemeStore } from "../lib/storage.ts";
import type { OpenTab, TabBrowser } from "../lib/tabs.ts";
import { Dom } from "./dom.ts";
import type { LinkDrag, LinkSource } from "./drag.ts";
import { HeaderView } from "./header-view.ts";
import { ImportDialog } from "./import-dialog.ts";
import type { PageActions } from "./page-actions.ts";
import { PageLook } from "./page-look.ts";
import type { PageState } from "./page-state.ts";
import { Renderer } from "./renderer.ts";

/** What the controller works with: the page root, the stores, the browser, the clock and the ids. */
export interface PageServices {
  readonly root: HTMLElement;
  readonly persistence: Persistence;
  readonly themes: ThemeStore;
  readonly pinnedFlag: FlagStore;
  readonly newTabFlag: FlagStore;
  readonly cardSizes: CardSizeStore;
  readonly browser: TabBrowser;
  readonly clock: Clock;
  readonly ids: IdSource;
}

/** The part of the page that a finished action rebuilds. */
type Region = "all" | "cards" | "panel" | "none";

/**
 * Every user action of the page: computes the new state with the domain classes, saves it, and
 * rebuilds what changed. A failure shows in the notice strip; nothing fails silently.
 */
export class PageController implements PageActions {
  private readonly renderer: Renderer;
  private readonly look = new PageLook();

  /**
   * Creates the controller and its renderer.
   * @param state the page state
   * @param services the stores and adapters
   */
  constructor(private readonly state: PageState, private readonly services: PageServices) {
    this.renderer = new Renderer(services.root, state, this);
  }

  /** Loads the settings, the cards and the open tabs, shows the page, and follows later changes. */
  async start(): Promise<void> {
    const services = this.services;
    this.state.theme = await services.themes.load();
    this.state.pinned = await services.pinnedFlag.load();
    this.state.newTabPage = await services.newTabFlag.load();
    this.state.cardSize = await services.cardSizes.load();
    this.look.applyTheme(this.state.theme);
    this.look.applyCardSize(this.state.cardSize);
    this.look.onSystemChange(() => {
      this.look.applyTheme(this.state.theme);
    });
    await this.loadBook();
    this.state.ownWindowId = await services.browser.currentWindowId();
    this.state.openTabs = await services.browser.openTabs();
    this.state.shortcut = await services.browser.actionShortcut();
    this.renderer.renderAll();
    services.browser.onChange(() => {
      this.run(() => this.loadTabs(), "panel");
    });
    services.persistence.onChange(() => {
      this.run(() => this.loadBook(), "all");
    });
  }

  /** @inheritdoc */
  search(query: string): void {
    this.state.query = query;
    this.renderer.renderCards();
  }

  /** @inheritdoc */
  filterTabs(query: string): void {
    this.state.tabQuery = query;
    this.renderer.renderPanel();
    this.renderer.focus("aside .search input", false);
  }

  /** @inheritdoc */
  createCard(name: string): void {
    const services = this.services;
    this.run(() => this.change(this.state.book.create(name, services.clock, services.ids)), "all");
  }

  /** @inheritdoc */
  exportBackup(): void {
    const now = this.services.clock.now();
    const text = BackupFile.serialize(this.state.book.toData(), now);
    Dom.download(BackupFile.fileName(now), text);
  }

  /** @inheritdoc */
  importFile(file: File): void {
    this.run(() => this.importText(file), "all");
  }

  /** @inheritdoc */
  cycleTheme(): void {
    const next = HeaderView.nextTheme(this.state.theme);
    this.run(async () => {
      await this.services.themes.save(next);
      this.state.theme = next;
      this.look.applyTheme(next);
    }, "all");
  }

  /** @inheritdoc */
  togglePin(): void {
    this.run(async () => {
      this.state.pinned = !this.state.pinned;
      await this.services.pinnedFlag.save(this.state.pinned);
    }, "all");
  }

  /** @inheritdoc */
  async setCardSize(size: CardSize): Promise<void> {
    try {
      await this.services.cardSizes.save(size);
      this.state.cardSize = size;
      this.look.applyCardSize(size);
    } catch (error: unknown) {
      this.renderer.notify(PageController.message(error), "error");
    }
  }

  /** @inheritdoc */
  setNewTabPage(on: boolean): void {
    this.run(async () => {
      await this.services.newTabFlag.save(on);
      this.state.newTabPage = on;
    }, "none");
  }

  /** @inheritdoc */
  openHelp(): void {
    const help = new URL("help.html", location.href).href;
    this.run(() => this.services.browser.jumpTo(help), "none");
  }

  /** @inheritdoc */
  openShortcuts(): void {
    this.run(() => this.services.browser.openInNewTab("chrome://extensions/shortcuts"), "none");
  }

  /** @inheritdoc */
  activateTab(tab: OpenTab): void {
    this.run(() => this.services.browser.activate(tab), "none");
  }

  /** @inheritdoc */
  openLink(url: string): void {
    this.run(() => this.services.browser.jumpTo(url), "none");
  }

  /** @inheritdoc */
  startRename(cardId: string): void {
    this.state.renaming = cardId;
    this.renderer.renderCards();
    this.renderer.focus(".card input.name", true);
  }

  /** @inheritdoc */
  renameCard(cardId: string, name: string): void {
    this.state.renaming = undefined;
    this.run(() => this.change(this.state.book.rename(cardId, name)), "all");
  }

  /** @inheritdoc */
  cancelRename(): void {
    this.state.renaming = undefined;
    this.renderer.renderCards();
  }

  /** @inheritdoc */
  startEditLink(source: LinkSource): void {
    this.state.editingLink = source;
    this.renderer.renderCards();
    this.renderer.focus(".page input.title", true);
  }

  /** @inheritdoc */
  editLink(source: LinkSource, title: string, url: string): void {
    this.state.editingLink = undefined;
    this.run(() => this.change(this.state.book.editPage(source.cardId, source.index, title, url)), "all");
  }

  /** @inheritdoc */
  cancelEditLink(): void {
    this.state.editingLink = undefined;
    this.renderer.renderCards();
  }

  /** @inheritdoc */
  removeLink(source: LinkSource): void {
    this.run(() => this.change(this.state.book.removePage(source.cardId, source.index)), "all");
  }

  /** @inheritdoc */
  deleteCard(cardId: string): void {
    this.run(() => this.change(this.state.book.remove(cardId)), "all");
  }

  /** @inheritdoc */
  reorderCard(cardId: string, place: number): void {
    this.run(() => this.change(this.state.book.reorderCollection(cardId, place)), "all");
  }

  /** @inheritdoc */
  dropLink(cardId: string, drag: LinkDrag, to: number | undefined): void {
    this.state.justAdded = { cardId, url: drag.page.url };
    this.run(() => this.change(this.placed(cardId, drag, to)), "all");
  }

  /**
   * The book after a drop: a saved link moves, an open tab is added (at a place, or at the end).
   * @param cardId the target card
   * @param drag the dragged link
   * @param to the place in the target card, undefined for the end
   * @returns the new book
   * @throws Error from the book, for example when the card already holds the address
   */
  private placed(cardId: string, drag: LinkDrag, to: number | undefined): CollectionBook {
    const book = this.state.book;
    if (drag.from !== undefined) {
      return book.movePage(drag.from.cardId, drag.from.index, cardId, to);
    }
    const added = book.addPage(cardId, drag.page);
    if (to === undefined) {
      return added;
    }
    const last = added.get(cardId).pages.length - 1;
    return added.reorderPage(cardId, last, to);
  }

  /**
   * Reads a backup file, asks how to take it, and takes it.
   * @param file the chosen file
   * @throws Error when the file is not a backup, or when saving fails
   */
  private async importText(file: File): Promise<void> {
    const data = BackupFile.parse(await file.text());
    const incoming = data.collections.length;
    const current = this.state.book.collections.length;
    const choice = await ImportDialog.ask({ fileName: file.name, incoming, current });
    if (choice === "cancel") {
      return;
    }
    const replace = choice === "replace";
    const next = replace ? CollectionBook.fromData(data) : this.state.book.merge(data);
    await this.change(next);
    const verb = replace ? "Replaced with" : "Merged";
    this.state.pendingNotice = `${verb} ${ImportDialog.cards(incoming)} from ${file.name}.`;
  }

  /** Reads the open tabs again. */
  private async loadTabs(): Promise<void> {
    this.state.openTabs = await this.services.browser.openTabs();
  }

  /** Loads the cards; a document from before 0.3.0 gets its colors stamped once. */
  private async loadBook(): Promise<void> {
    const persistence = this.services.persistence;
    const data = await persistence.load();
    const loaded = data === undefined ? CollectionBook.empty() : CollectionBook.fromData(data);
    this.state.book = loaded.assignHues();
    if (this.state.book !== loaded) {
      await persistence.save(this.state.book.toData());
    }
  }

  /**
   * Takes a new book and saves it; an imported document may lack colors.
   * @param next the new book
   */
  private async change(next: CollectionBook): Promise<void> {
    this.state.book = next.assignHues();
    await this.services.persistence.save(this.state.book.toData());
  }

  /**
   * Runs an action, then rebuilds a region; a failure rebuilds too and shows in the notice strip.
   * @param action the work
   * @param region what to rebuild afterwards
   */
  private run(action: () => Promise<void>, region: Region): void {
    action().then(
      () => {
        this.redraw(region);
      },
      (error: unknown) => {
        this.redraw(region);
        this.renderer.notify(PageController.message(error), "error");
      },
    );
  }

  /**
   * Rebuilds a region.
   * @param region what to rebuild
   */
  private redraw(region: Region): void {
    if (region === "all") {
      this.renderer.renderAll();
      return;
    }
    if (region === "cards") {
      this.renderer.renderCards();
      return;
    }
    if (region === "panel") {
      this.renderer.renderPanel();
    }
  }

  /**
   * The text of a failure.
   * @param error what was thrown
   * @returns its message
   */
  private static message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
