import { DocumentReader } from "./document-reader.ts";
import type { Card, LibraryData } from "./model.ts";
import { MAIN_COLLECTION, SCHEMA_VERSION, STORAGE_KEY } from "./model.ts";

/** Where the library document lives. */
export interface Persistence {
  /** The stored document, or undefined when nothing was ever saved. */
  load(): Promise<LibraryData | undefined>;
  /** Saves the document. */
  save(data: LibraryData): Promise<void>;
  /** Calls the listener after the document was saved, by this page or another one. */
  onChange(listener: () => void): void;
}

/** The part of chrome.storage.local this module uses; a fake implements it in tests. */
export interface KeyValueArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
}

/** The part of chrome.storage.onChanged this module uses. */
export interface ChangeEvent {
  addListener(callback: (changes: Record<string, unknown>) => void): void;
}

/**
 * The library document in a key-value area such as chrome.storage.local; never syncs. A stored
 * schema-1 document (Tabuzaur 0.8 and earlier) is copied unchanged under BACKUP_KEY, then upgraded
 * to one collection "Main" and saved, once.
 */
export class LibraryStore implements Persistence {
  /** Where the old document is kept after the upgrade, so a bad upgrade cannot lose it. */
  static readonly BACKUP_KEY = "tabuzaur-backup-v1";

  /**
   * Creates the store.
   * @param area chrome.storage.local, or a fake
   * @param changes chrome.storage.onChanged, or a fake
   */
  constructor(private readonly area: KeyValueArea, private readonly changes: ChangeEvent) {}

  /**
   * The cards of 0.8 as a schema-2 document: one collection "Main".
   * @param cards the cards
   * @returns the document
   */
  static upgrade(cards: readonly Card[]): LibraryData {
    return { schemaVersion: SCHEMA_VERSION, collections: [{ ...MAIN_COLLECTION, cards }] };
  }

  /** @inheritdoc */
  onChange(listener: () => void): void {
    this.changes.addListener((changes) => {
      if (STORAGE_KEY in changes) {
        listener();
      }
    });
  }

  /**
   * The stored document; an old one is kept under BACKUP_KEY, upgraded and saved first.
   * @returns the document, or undefined when nothing was ever saved
   * @throws Error naming the first field that is not the schema
   */
  async load(): Promise<LibraryData | undefined> {
    const items = await this.area.get(STORAGE_KEY);
    const raw = items[STORAGE_KEY];
    if (raw === undefined) {
      return undefined;
    }
    const content = DocumentReader.read(raw);
    if (content.kind === "library") {
      return content.data;
    }
    await this.area.set({ [LibraryStore.BACKUP_KEY]: raw });
    const upgraded = LibraryStore.upgrade(content.cards);
    await this.save(upgraded);
    return upgraded;
  }

  /** @inheritdoc */
  async save(data: LibraryData): Promise<void> {
    await this.area.set({ [STORAGE_KEY]: data });
  }
}
