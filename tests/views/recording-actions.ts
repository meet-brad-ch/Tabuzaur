import type { CardWidth } from "../../src/lib/settings.ts";
import type { OpenTab } from "../../src/lib/tabs.ts";
import type { LinkDrag, LinkSource } from "../../src/tabs/drag.ts";
import type { PageActions } from "../../src/tabs/page-actions.ts";

/** One call a view made. */
export interface ActionCall {
  readonly name: string;
  readonly args: readonly unknown[];
}

/** A PageActions that records every call, for view tests. */
export class RecordingActions implements PageActions {
  readonly calls: ActionCall[] = [];

  /** The names of the calls, in order. */
  names(): string[] {
    return this.calls.map((c) => c.name);
  }

  /** The last call, which must exist. */
  last(): ActionCall {
    const call = this.calls[this.calls.length - 1];
    if (call === undefined) {
      throw new Error("no action was called");
    }
    return call;
  }

  search(query: string): void { this.record("search", query); }
  filterTabs(query: string): void { this.record("filterTabs", query); }
  createCard(name: string): void { this.record("createCard", name); }
  exportBackup(): void { this.record("exportBackup"); }
  importFile(file: File): void { this.record("importFile", file); }
  cycleTheme(): void { this.record("cycleTheme"); }
  togglePin(): void { this.record("togglePin"); }
  setCardWidth(width: CardWidth): Promise<void> {
    this.record("setCardWidth", width);
    return Promise.resolve();
  }
  setNewTabPage(on: boolean): void { this.record("setNewTabPage", on); }
  openHelp(): void { this.record("openHelp"); }
  openShortcuts(): void { this.record("openShortcuts"); }
  activateTab(tab: OpenTab): void { this.record("activateTab", tab); }
  openLink(url: string): void { this.record("openLink", url); }
  startRename(cardId: string): void { this.record("startRename", cardId); }
  renameCard(cardId: string, name: string): void { this.record("renameCard", cardId, name); }
  cancelRename(): void { this.record("cancelRename"); }
  startEditLink(source: LinkSource): void { this.record("startEditLink", source); }
  editLink(source: LinkSource, title: string, url: string): void { this.record("editLink", source, title, url); }
  cancelEditLink(): void { this.record("cancelEditLink"); }
  removeLink(source: LinkSource): void { this.record("removeLink", source); }
  deleteCard(cardId: string): void { this.record("deleteCard", cardId); }
  reorderCard(cardId: string, place: number): void { this.record("reorderCard", cardId, place); }
  dropLink(cardId: string, drag: LinkDrag, to: number | undefined): void { this.record("dropLink", cardId, drag, to); }

  private record(name: string, ...args: unknown[]): void {
    this.calls.push({ name, args });
  }
}
