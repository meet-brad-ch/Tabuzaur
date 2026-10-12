import type { Clock, Collection, IdSource, SavedPage, StoreData } from "./model.ts";
import { SCHEMA_VERSION } from "./model.ts";

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

  /** Appends an empty collection. The name is trimmed; an empty name is an error. */
  create(name: string, clock: Clock, ids: IdSource): CollectionBook {
    const created: Collection = {
      id: ids.next(),
      name: validName(name),
      createdAt: clock.now().toISOString(),
      pages: [],
    };
    return new CollectionBook([...this.collections, created]);
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

  /** Changes a page's title. The title is trimmed; an empty title is an error. */
  retitlePage(id: string, index: number, title: string): CollectionBook {
    const collection = this.get(id);
    const page = collection.pages[index];
    if (page === undefined) {
      throw new Error(`collection ${id} has no page at index ${String(index)}`);
    }
    const trimmed = title.trim();
    if (trimmed === "") {
      throw new Error("a link needs a title");
    }
    const pages = collection.pages.map((p, i) => (i === index ? { ...p, title: trimmed } : p));
    return this.replace(id, { ...collection, pages });
  }

  /**
   * Moves one page to the end of another collection. A URL already in the target is an error;
   * a move onto the page's own collection changes nothing.
   */
  movePage(fromId: string, index: number, toId: string): CollectionBook {
    if (fromId === toId) {
      return this;
    }
    const page = this.get(fromId).pages[index];
    if (page === undefined) {
      throw new Error(`collection ${fromId} has no page at index ${String(index)}`);
    }
    return this.addPage(toId, page).removePage(fromId, index);
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

function validName(name: string): string {
  const trimmed = name.trim();
  if (trimmed === "") {
    throw new Error("a collection needs a name");
  }
  return trimmed;
}
