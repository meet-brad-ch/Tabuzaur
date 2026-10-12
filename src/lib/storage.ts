import type { Collection, SavedPage, StoreData } from "./model.ts";
import { SCHEMA_VERSION, STORAGE_KEY } from "./model.ts";

/** Where the store document lives. */
export interface Persistence {
  /** The stored document, or undefined when nothing was ever saved. */
  load(): Promise<StoreData | undefined>;
  save(data: StoreData): Promise<void>;
}

/** The part of chrome.storage.local this module uses; a fake implements it in tests. */
export interface KeyValueArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

/** Persistence in a key-value area such as chrome.storage.local. Never syncs. */
export class LocalPersistence implements Persistence {
  constructor(private readonly area: KeyValueArea) {}

  async load(): Promise<StoreData | undefined> {
    const items = await this.area.get(STORAGE_KEY);
    const raw = items[STORAGE_KEY];
    if (raw === undefined) {
      return undefined;
    }
    return parseStoreData(raw);
  }

  async save(data: StoreData): Promise<void> {
    await this.area.set({ [STORAGE_KEY]: data });
  }
}

/** Validates a stored document. Throws on anything that is not the current schema. */
export function parseStoreData(raw: unknown): StoreData {
  const doc = asRecord(raw, "store");
  if (doc.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`unsupported schemaVersion ${JSON.stringify(doc.schemaVersion)}`);
  }
  if (!Array.isArray(doc.collections)) {
    throw new Error("store.collections is not an array");
  }
  const collections = doc.collections.map((c: unknown, i) => parseCollection(c, i));
  return { schemaVersion: SCHEMA_VERSION, collections };
}

function parseCollection(raw: unknown, index: number): Collection {
  const where = `collections[${String(index)}]`;
  const c = asRecord(raw, where);
  if (!Array.isArray(c.pages)) {
    throw new Error(`${where}.pages is not an array`);
  }
  return {
    id: asString(c.id, `${where}.id`),
    name: asString(c.name, `${where}.name`),
    createdAt: asString(c.createdAt, `${where}.createdAt`),
    pages: c.pages.map((t: unknown, j) => parsePage(t, `${where}.pages[${String(j)}]`)),
  };
}

function parsePage(raw: unknown, where: string): SavedPage {
  const t = asRecord(raw, where);
  const page: SavedPage = { title: asString(t.title, `${where}.title`), url: asString(t.url, `${where}.url`) };
  if (t.favIconUrl === undefined) {
    return page;
  }
  return { ...page, favIconUrl: asString(t.favIconUrl, `${where}.favIconUrl`) };
}

function asRecord(raw: unknown, where: string): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`${where} is not an object`);
  }
  return raw as Record<string, unknown>;
}

function asString(raw: unknown, where: string): string {
  if (typeof raw !== "string") {
    throw new Error(`${where} is not a string`);
  }
  return raw;
}
