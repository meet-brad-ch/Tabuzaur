import type { CardSize } from "../lib/storage.ts";
import type { OpenTab } from "../lib/tabs.ts";
import type { LinkDrag, LinkSource } from "./drag.ts";

/** Everything a view may ask the page to do. The controller implements it; views never change state. */
export interface PageActions {
  /** Shows the cards that match the query. */
  search(query: string): void;
  /** Shows the open tabs that match the query. */
  filterTabs(query: string): void;
  /** Creates a card with this name. */
  createCard(name: string): void;
  /** Downloads a backup of everything. */
  exportBackup(): void;
  /** Reads a backup file and asks how to take it. */
  importFile(file: File): void;
  /** Switches to the next theme: system, light, dark. */
  cycleTheme(): void;
  /** Pins or unpins the open-tab panel. */
  togglePin(): void;
  /** Saves the card width; resolves when saved or when the failure is shown. */
  setCardSize(size: CardSize): Promise<void>;
  /** Saves the new-tab option. */
  setNewTabPage(on: boolean): void;
  /** Opens the help page, or brings it to the front. */
  openHelp(): void;
  /** Opens Chrome's keyboard shortcut settings. */
  openShortcuts(): void;
  /** Brings an open tab and its window to the front. */
  activateTab(tab: OpenTab): void;
  /** Jumps to the tab showing the address, or opens it. */
  openLink(url: string): void;
  /** Opens the name editor of a card. */
  startRename(cardId: string): void;
  /** Saves a card's new name. */
  renameCard(cardId: string, name: string): void;
  /** Closes the name editor without a change. */
  cancelRename(): void;
  /** Opens the editor of a link. */
  startEditLink(source: LinkSource): void;
  /** Saves a link's title and address. */
  editLink(source: LinkSource, title: string, url: string): void;
  /** Closes the link editor without a change. */
  cancelEditLink(): void;
  /** Removes a link from its card. */
  removeLink(source: LinkSource): void;
  /** Deletes a card with its links. */
  deleteCard(cardId: string): void;
  /** Moves a card to a place among the cards. */
  reorderCard(cardId: string, place: number): void;
  /** Puts a dragged link into a card, at a place or at the end. */
  dropLink(cardId: string, drag: LinkDrag, to: number | undefined): void;
}
