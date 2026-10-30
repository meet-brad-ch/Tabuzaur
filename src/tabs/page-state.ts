import { Library } from "../lib/library.ts";
import type { Collection } from "../lib/model.ts";
import { SettingsStore } from "../lib/settings.ts";
import type { Settings } from "../lib/settings.ts";
import type { OpenTab } from "../lib/tabs.ts";
import type { LinkSource } from "./drag.ts";

/** A link that was just dropped into a card: it shows a short highlight on the next render. */
export interface AddedLink {
  readonly cardId: string;
  readonly url: string;
}

/** Everything the page shows, in one place. Views read it; only the controller changes it. */
export class PageState {
  /** The collections, their cards and links. */
  library = Library.empty();
  /** The tabs open in every window. */
  openTabs: readonly OpenTab[] = [];
  /** The window this page lives in, -1 until known. */
  ownWindowId = -1;
  /** The search over cards and links. */
  query = "";
  /** The filter over the open tabs in the panel. */
  tabQuery = "";
  /** The viewer's choices: theme, card width, pinned panel, new-tab page. */
  settings: Settings = SettingsStore.DEFAULTS;
  /** The key Chrome assigned to open Tabuzaur; empty when none. */
  shortcut = "";
  /** The card whose name is being edited. */
  renaming: string | undefined = undefined;
  /** The link whose title and address are being edited. */
  editingLink: LinkSource | undefined = undefined;
  /** The link to highlight once. */
  justAdded: AddedLink | undefined = undefined;
  /** The collection whose name is being edited in the tab bar. */
  renamingCollection: string | undefined = undefined;
  /** Whether the name field of a new collection is open in the tab bar. */
  addingCollection = false;
  /** The tab that flashes once after a card was dropped on it. */
  flashCollectionId: string | undefined = undefined;
  /** Whether the next full render starts the cards at their top (after a tab switch). */
  cardsToTop = false;
  /** An info notice to show after the next full render. */
  pendingNotice: string | undefined = undefined;
  /** The windows folded in the panel. */
  readonly collapsed = new Set<number>();

  /**
   * Creates the state.
   * @param ownUrl the address of the Tabuzaur page; its own tabs are left out of the panel
   */
  constructor(readonly ownUrl: string) {}

  /**
   * The collection shown on the page.
   * @returns the open collection, or the first one when the open one no longer exists
   */
  openCollection(): Collection {
    const library = this.library;
    const openId = this.settings.openCollectionId;
    if (library.hasCollection(openId)) {
      return library.collection(openId);
    }
    const first = library.collections[0];
    if (first === undefined) {
      throw new Error("the library has no collection");
    }
    return first;
  }
}
