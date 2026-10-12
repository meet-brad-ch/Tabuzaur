import type { Clock, IdSource, SavedPage } from "../src/lib/model.ts";
import type { ChangeEvent, KeyValueArea } from "../src/lib/storage.ts";

export class FixedClock implements Clock {
  constructor(private readonly iso: string) {}
  now(): Date {
    return new Date(this.iso);
  }
}

export class CountingIdSource implements IdSource {
  private count = 0;
  next(): string {
    this.count += 1;
    return `id-${String(this.count)}`;
  }
}

/** An in-memory stand-in for chrome.storage.local that round-trips through JSON like Chrome does. */
export class MemoryArea implements KeyValueArea {
  private readonly items = new Map<string, string>();

  get(key: string): Promise<Record<string, unknown>> {
    const json = this.items.get(key);
    return Promise.resolve(json === undefined ? {} : { [key]: JSON.parse(json) as unknown });
  }

  set(items: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(items)) {
      this.items.set(key, JSON.stringify(value));
    }
    return Promise.resolve();
  }

  /** Puts an arbitrary value under a key, for tests of corrupt data. */
  seed(key: string, value: unknown): void {
    this.items.set(key, JSON.stringify(value));
  }
}

export const pageA: SavedPage = { title: "Example", url: "https://example.com/" };
export const pageB: SavedPage = {
  title: "Docs",
  url: "https://docs.example.com/x",
  favIconUrl: "https://docs.example.com/i.png",
};

/** A change event that never fires. */
export const noChanges: ChangeEvent = {
  addListener(): void {
    // nothing changes in these tests
  },
};
