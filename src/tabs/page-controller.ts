import { BackupFile } from "../lib/backup.ts";
import { ImportPlan } from "../lib/import-plan.ts";
import { Library } from "../lib/library.ts";
import type { Clock, IdSource } from "../lib/model.ts";
import type { CardWidth, Settings, SettingsStore } from "../lib/settings.ts";
import type { Persistence } from "../lib/storage.ts";
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
  readonly settings: SettingsStore;
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
    this.state.settings = await services.settings.load();
    this.look.applyTheme(this.state.settings.theme);
    this.look.applyCardWidth(this.state.settings.cardWidth);
    this.look.onSystemChange(() => {
      this.look.applyTheme(this.state.settings.theme);
    });
    await this.loadLibrary();
    this.state.ownWindowId = await services.browser.currentWindowId();
    this.state.openTabs = await services.browser.openTabs();
    this.state.shortcut = await services.browser.actionShortcut();
    this.renderer.renderAll();
    services.browser.onChange(() => {
      this.run(() => this.loadTabs(), "panel");
    });
    services.persistence.onChange(() => {
      this.run(() => this.loadLibrary(), "all");
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
    const open = this.state.openCollection().id;
    this.run(() => this.change(this.state.library.createCard(open, name, services.clock, services.ids)), "all");
  }

  /** @inheritdoc */
  exportBackup(): void {
    const now = this.services.clock.now();
    const text = BackupFile.serialize(this.state.library.toData(), now);
    Dom.download(BackupFile.fileName(now), text);
  }

  /** @inheritdoc */
  importFile(file: File): void {
    this.run(() => this.importText(file), "all");
  }

  /** @inheritdoc */
  cycleTheme(): void {
    const next = HeaderView.nextTheme(this.state.settings.theme);
    this.run(async () => {
      await this.saveSettings({ ...this.state.settings, theme: next });
      this.look.applyTheme(next);
    }, "all");
  }

  /** @inheritdoc */
  togglePin(): void {
    const pinned = !this.state.settings.panelPinned;
    this.run(() => this.saveSettings({ ...this.state.settings, panelPinned: pinned }), "all");
  }

  /** @inheritdoc */
  async setCardWidth(width: CardWidth): Promise<void> {
    try {
      await this.saveSettings({ ...this.state.settings, cardWidth: width });
      this.look.applyCardWidth(width);
    } catch (error: unknown) {
      this.renderer.notify(PageController.message(error), "error");
    }
  }

  /** @inheritdoc */
  setNewTabPage(on: boolean): void {
    this.run(() => this.saveSettings({ ...this.state.settings, newTabPage: on }), "none");
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
    this.run(() => this.change(this.state.library.renameCard(cardId, name)), "all");
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
    this.run(() => this.change(this.state.library.editLink(source.cardId, source.index, title, url)), "all");
  }

  /** @inheritdoc */
  cancelEditLink(): void {
    this.state.editingLink = undefined;
    this.renderer.renderCards();
  }

  /** @inheritdoc */
  removeLink(source: LinkSource): void {
    this.run(() => this.change(this.state.library.removeLink(source.cardId, source.index)), "all");
  }

  /** @inheritdoc */
  deleteCard(cardId: string): void {
    this.run(() => this.change(this.state.library.removeCard(cardId)), "all");
  }

  /** @inheritdoc */
  reorderCard(cardId: string, place: number): void {
    this.run(() => this.change(this.state.library.reorderCard(cardId, place)), "all");
  }

  /** @inheritdoc */
  dropLink(cardId: string, drag: LinkDrag, to: number | undefined): void {
    this.state.justAdded = { cardId, url: drag.link.url };
    this.run(() => this.change(this.placed(cardId, drag, to)), "all");
  }

  /**
   * The library after a drop: a saved link moves, an open tab is added (at a place, or at the end).
   * @param cardId the target card
   * @param drag the dragged link
   * @param to the place in the target card, undefined for the end
   * @returns the new library
   * @throws Error from the library, for example when the card already holds the address
   */
  private placed(cardId: string, drag: LinkDrag, to: number | undefined): Library {
    const library = this.state.library;
    if (drag.from !== undefined) {
      return library.moveLink(drag.from.cardId, drag.from.index, cardId, to);
    }
    return library.addLink(cardId, drag.link, to);
  }

  /**
   * Reads a backup file, asks how to take it, and takes it.
   * @param file the chosen file
   * @throws Error when the file is not a backup, or when saving fails
   */
  private async importText(file: File): Promise<void> {
    const content = BackupFile.parse(await file.text());
    const library = this.state.library;
    const open = this.state.openCollection();
    const choice = await ImportDialog.ask({
      fileName: file.name,
      summary: ImportPlan.summary(content),
      openName: open.name,
      openCards: open.cards.length,
      collections: library.collections.length,
      cards: library.allCards().length,
    });
    if (choice === "cancel") {
      return;
    }
    const target = { library, openCollectionId: open.id, fileName: file.name, ids: this.services.ids };
    const outcome = ImportPlan.apply(content, choice, target);
    await this.change(outcome.library);
    this.state.pendingNotice = outcome.notice;
  }

  /**
   * Saves the settings, then takes them; a failed save leaves the state as it was.
   * @param next the new record
   */
  private async saveSettings(next: Settings): Promise<void> {
    await this.services.settings.save(next);
    this.state.settings = next;
  }

  /** Reads the open tabs again. */
  private async loadTabs(): Promise<void> {
    this.state.openTabs = await this.services.browser.openTabs();
  }

  /** Loads the library; an old document is upgraded by the store. */
  private async loadLibrary(): Promise<void> {
    const data = await this.services.persistence.load();
    this.state.library = data === undefined ? Library.empty() : Library.fromData(data);
  }

  /**
   * Takes a new library and saves it.
   * @param next the new library
   */
  private async change(next: Library): Promise<void> {
    this.state.library = next;
    await this.services.persistence.save(next.toData());
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
