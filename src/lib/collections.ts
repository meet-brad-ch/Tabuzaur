import type { Clock, Collection, IdSource, SavedPage, StoreData } from "./model.ts";
import { HUE_COUNT, SCHEMA_VERSION } from "./model.ts";
import { Palette } from "./palette.ts";

/**
 * The immutable list of collections with every operation the pages need.
 * Each operation returns a new book; nothing here touches Chrome or storage.
 */
export class CollectionBook {
  private constructor(readonly collections: readonly Collection[]) {}

  static empty(): CollectionBook {
    return new CollectionBook([]);
  }

  static fromData(data: StoreData): CollectionBook {
    return new CollectionBook(data.collections);
  }

  toData(): StoreData {
    return { schemaVersion: SCHEMA_VERSION, collections: this.collections };
  }

  /** Appends an empty collection with the next free color. The name is trimmed; an empty name is an error. */
  create(name: string, clock: Clock, ids: IdSource): CollectionBook {
    const created: Collection = {
      id: ids.next(),
      name: validName(name),
      createdAt: clock.now().toISOString(),
      pages: [],
      hue: this.nextHue(),
    };
    return new CollectionBook([...this.collections, created]);
  }

  /**
   * The least-used hue, looking from the one after the last collection's hue, so neighbours
   * differ and the palette is spent evenly.
   */
  nextHue(): number {
    const hues = this.collections.map((c) => c.hue);
    return Palette.next(hues);
  }

  /** Gives every collection without a hue the color it shows today (its position), so colors stick from now on. */
  assignHues(): CollectionBook {
    if (this.collections.every((c) => c.hue !== undefined)) {
      return this;
    }
    return new CollectionBook(this.collections.map((c, i) => (c.hue === undefined ? { ...c, hue: i % HUE_COUNT } : c)));
  }

  get(id: string): Collection {
    const found = this.collections.find((c) => c.id === id);
    if (found === undefined) {
      throw new Error(`no collection with id ${id}`);
    }
    return found;
  }

  remove(id: string): CollectionBook {
    this.get(id);
    return new CollectionBook(this.collections.filter((c) => c.id !== id));
  }

  rename(id: string, name: string): CollectionBook {
    return this.replace(id, { ...this.get(id), name: validName(name) });
  }

  /** Appends a page. A URL already in the collection is an error, so the caller can say so. */
  addPage(id: string, page: SavedPage): CollectionBook {
    const collection = this.get(id);
    if (collection.pages.some((p) => p.url === page.url)) {
      throw new Error(`already in ${collection.name}`);
    }
    return this.replace(id, { ...collection, pages: [...collection.pages, page] });
  }

  /** Removes one page by index. An emptied collection stays. */
  removePage(id: string, index: number): CollectionBook {
    const collection = this.get(id);
    if (!Number.isInteger(index) || index < 0 || index >= collection.pages.length) {
      throw new Error(`collection ${id} has no page at index ${String(index)}`);
    }
    return this.replace(id, { ...collection, pages: collection.pages.filter((_, i) => i !== index) });
  }

  /**
   * Changes a page's title and url. Both are trimmed; an empty title, a url that does not parse,
   * or a url already used by another page of the collection is an error.
   */
  editPage(id: string, index: number, title: string, url: string): CollectionBook {
    const collection = this.get(id);
    this.pageAt(collection, index);
    const newTitle = title.trim();
    if (newTitle === "") {
      throw new Error("a link needs a title");
    }
    const newUrl = validUrl(url);
    if (collection.pages.some((p, i) => i !== index && p.url === newUrl)) {
      throw new Error(`already in ${collection.name}`);
    }
    const pages = collection.pages.map((p, i) => (i === index ? { ...p, title: newTitle, url: newUrl } : p));
    return this.replace(id, { ...collection, pages });
  }

  /**
   * Moves the page at `from` so that it sits where index `to` was before the move (0 .. length,
   * length meaning the end). Moving a page onto its own place changes nothing.
   */
  reorderPage(id: string, from: number, to: number): CollectionBook {
    const collection = this.get(id);
    const page = this.pageAt(collection, from);
    if (!Number.isInteger(to) || to < 0 || to > collection.pages.length) {
      throw new Error(`collection ${id} has no place at index ${String(to)}`);
    }
    const rest = collection.pages.filter((_, i) => i !== from);
    const at = to > from ? to - 1 : to;
    const pages = [...rest.slice(0, at), page, ...rest.slice(at)];
    return this.replace(id, { ...collection, pages });
  }

  /**
   * Moves one page into another collection, at `to` (0 .. length, default the end). A URL already
   * in the target is an error; a move within the same collection is a reorder.
   */
  movePage(fromId: string, index: number, toId: string, to?: number): CollectionBook {
    if (fromId === toId) {
      return to === undefined ? this : this.reorderPage(fromId, index, to);
    }
    const page = this.pageAt(this.get(fromId), index);
    const added = this.addPage(toId, page).removePage(fromId, index);
    if (to === undefined) {
      return added;
    }
    const target = added.get(toId);
    return added.reorderPage(toId, target.pages.length - 1, to);
  }

  /**
   * Moves a collection so that it sits where index `to` was before the move (0 .. length, length
   * meaning the end). Moving it onto its own place changes nothing.
   */
  reorderCollection(id: string, to: number): CollectionBook {
    const collection = this.get(id);
    if (!Number.isInteger(to) || to < 0 || to > this.collections.length) {
      throw new Error(`no place for a collection at index ${String(to)}`);
    }
    const from = this.collections.indexOf(collection);
    const rest = this.collections.filter((c) => c.id !== id);
    const at = to > from ? to - 1 : to;
    return new CollectionBook([...rest.slice(0, at), collection, ...rest.slice(at)]);
  }

  private pageAt(collection: Collection, index: number): SavedPage {
    const page = Number.isInteger(index) ? collection.pages[index] : undefined;
    if (page === undefined) {
      throw new Error(`collection ${collection.id} has no page at index ${String(index)}`);
    }
    return page;
  }

  /**
   * Adds another document's collections without removing anything. An imported collection joins
   * the existing one with the same id, else the one with the same name (case-insensitive), and
   * contributes the pages whose url that collection lacks; otherwise it is appended as it is.
   */
  merge(other: StoreData): CollectionBook {
    return other.collections.reduce<CollectionBook>((book, incoming) => book.absorb(incoming), this);
  }

  private absorb(incoming: Collection): CollectionBook {
    const target = this.collections.find((c) => c.id === incoming.id)
      ?? this.collections.find((c) => sameName(c.name, incoming.name));
    if (target === undefined) {
      return new CollectionBook([...this.collections, incoming]);
    }
    const known = new Set(target.pages.map((p) => p.url));
    const added = incoming.pages.filter((p) => !known.has(p.url));
    return this.replace(target.id, { ...target, pages: [...target.pages, ...added] });
  }

  /** Collections whose name, or any page title or url, contains the query (case-insensitive). */
  search(query: string): readonly Collection[] {
    const needle = query.trim().toLowerCase();
    if (needle === "") {
      return this.collections;
    }
    const hit = (text: string): boolean => text.toLowerCase().includes(needle);
    return this.collections.filter(
      (c) => hit(c.name) || c.pages.some((p) => hit(p.title) || hit(p.url)),
    );
  }

  private replace(id: string, updated: Collection): CollectionBook {
    return new CollectionBook(this.collections.map((c) => (c.id === id ? updated : c)));
  }
}

/** The trimmed url, if it parses as one. */
function validUrl(url: string): string {
  const trimmed = url.trim();
  try {
    new URL(trimmed);
  } catch {
    throw new Error(`not a valid url: ${trimmed}`);
  }
  return trimmed;
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function validName(name: string): string {
  const trimmed = name.trim();
  if (trimmed === "") {
    throw new Error("a collection needs a name");
  }
  return trimmed;
}
