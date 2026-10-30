import { CollectionBook } from "../lib/collections.ts";
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
  /** The saved cards and links. */
  book = CollectionBook.empty();
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
  /** An info notice to show after the next full render. */
  pendingNotice: string | undefined = undefined;
  /** The windows folded in the panel. */
  readonly collapsed = new Set<number>();

  /**
   * Creates the state.
   * @param ownUrl the address of the Tabuzaur page; its own tabs are left out of the panel
   */
  constructor(readonly ownUrl: string) {}
}
