import type { Library } from "./library.ts";
import { LibrarySearch } from "./library-search.ts";

/** What one tab of the collection bar shows. */
export interface TabModel {
  readonly id: string;
  readonly name: string;
  /** The tab whose cards the page shows. */
  readonly open: boolean;
  /** How many of its cards match the search; undefined while no search is typed. */
  readonly count: number | undefined;
  /** Whether its trash deletes it. */
  readonly deletable: boolean;
  /** The trash's tooltip: what it does, or why it cannot. */
  readonly deleteLabel: string;
}

/** The model of the collection bar: one tab per collection, with its count and its delete rule. */
export class TabStrip {
  /**
   * The tabs.
   * @param library the library
   * @param openId the open collection; the first one is open when it does not exist
   * @param query the search query; blank for no counts
   * @returns one model per collection, in order
   */
  static tabs(library: Library, openId: string, query: string): TabModel[] {
    const open = library.hasCollection(openId) ? openId : library.collections[0]?.id;
    const searching = query.trim() !== "";
    const last = library.collections.length === 1;
    return library.collections.map((c) => {
      const empty = c.cards.length === 0;
      return {
        id: c.id,
        name: c.name,
        open: c.id === open,
        count: searching ? LibrarySearch.matchCount(c, query) : undefined,
        deletable: empty && !last,
        deleteLabel: TabStrip.deleteLabel(empty, last),
      };
    });
  }

  /**
   * The trash's tooltip.
   * @param empty whether the collection holds no cards
   * @param last whether it is the only collection
   * @returns the action, or the reason it is not possible
   */
  private static deleteLabel(empty: boolean, last: boolean): string {
    if (last) {
      return "The last collection stays";
    }
    if (!empty) {
      return "Move or delete its cards first";
    }
    return "Delete this collection";
  }
}
