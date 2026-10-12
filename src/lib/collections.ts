import type { Clock, Collection, IdSource, SavedTab, StoreData } from "./model.ts";
import { SCHEMA_VERSION } from "./model.ts";

/**
 * The immutable list of collections with every operation the popup needs.
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

  /** Adds a collection at the top. The name is trimmed; an empty name or no tabs is an error. */
  add(name: string, tabs: readonly SavedTab[], clock: Clock, ids: IdSource): CollectionBook {
    const trimmed = name.trim();
    if (trimmed === "") {
      throw new Error("a collection needs a name");
    }
    if (tabs.length === 0) {
      throw new Error("a collection needs at least one tab");
    }
    const created: Collection = {
      id: ids.next(),
      name: trimmed,
      createdAt: clock.now().toISOString(),
      tabs: [...tabs],
    };
    return new CollectionBook([created, ...this.collections]);
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
    const trimmed = name.trim();
    if (trimmed === "") {
      throw new Error("a collection needs a name");
    }
    return this.replace(id, { ...this.get(id), name: trimmed });
  }

  /** Removes one tab by index. Removing the last tab removes the collection. */
  removeTab(id: string, index: number): CollectionBook {
    const collection = this.get(id);
    if (!Number.isInteger(index) || index < 0 || index >= collection.tabs.length) {
      throw new Error(`collection ${id} has no tab at index ${String(index)}`);
    }
    const tabs = collection.tabs.filter((_, i) => i !== index);
    if (tabs.length === 0) {
      return this.remove(id);
    }
    return this.replace(id, { ...collection, tabs });
  }

  /** Collections whose name, or any tab title or url, contains the query (case-insensitive). */
  search(query: string): readonly Collection[] {
    const needle = query.trim().toLowerCase();
    if (needle === "") {
      return this.collections;
    }
    const hit = (text: string): boolean => text.toLowerCase().includes(needle);
    return this.collections.filter(
      (c) => hit(c.name) || c.tabs.some((t) => hit(t.title) || hit(t.url)),
    );
  }

  private replace(id: string, updated: Collection): CollectionBook {
    return new CollectionBook(this.collections.map((c) => (c.id === id ? updated : c)));
  }
}
