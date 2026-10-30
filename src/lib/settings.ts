import type { KeyValueArea } from "./storage.ts";

/** The page's color theme: follow the system, or force one. */
export type Theme = "system" | "light" | "dark";
/** The themes in the order the theme button cycles through them. */
export const THEMES: readonly Theme[] = ["system", "light", "dark"];

/** The least width of a card, as a step; the stylesheet maps each step to pixels. */
export type CardWidth = "small" | "medium" | "large";
/** The steps of the card width bar, narrow to wide. */
export const CARD_WIDTHS: readonly CardWidth[] = ["small", "medium", "large"];

/** Every choice the viewer makes in Tabuzaur, stored as one record. */
export interface Settings {
  readonly theme: Theme;
  readonly cardWidth: CardWidth;
  /** The open-tab panel stays open as a column. */
  readonly panelPinned: boolean;
  /** A new blank tab shows the Tabuzaur page instead of Chrome's new-tab page. */
  readonly newTabPage: boolean;
}

/**
 * The settings record in a key-value area, under one key. The first load after an update from
 * 0.8 or earlier moves the four separate keys of those versions into the record and removes them.
 */
export class SettingsStore {
  /** Where the record lives. */
  static readonly KEY = "tabuzaur-settings";
  /** The choices before the viewer made any. */
  static readonly DEFAULTS: Settings = { theme: "system", cardWidth: "medium", panelPinned: false, newTabPage: false };

  /**
   * Creates the store.
   * @param area chrome.storage.local, or a fake in tests
   */
  constructor(private readonly area: KeyValueArea) {}

  /**
   * The stored settings; the defaults when none were ever saved.
   * @returns the record
   * @throws Error naming the field, when the stored record or an old key holds a value it does not know
   */
  async load(): Promise<Settings> {
    const items = await this.area.get(SettingsStore.KEY);
    const raw = items[SettingsStore.KEY];
    if (raw !== undefined) {
      return SettingsReader.read(raw);
    }
    const legacy = new LegacySettings(this.area);
    if (!(await legacy.exists())) {
      return SettingsStore.DEFAULTS;
    }
    const moved = await legacy.read();
    await this.save(moved);
    await legacy.remove();
    return moved;
  }

  /**
   * Saves the whole record.
   * @param settings the record
   */
  async save(settings: Settings): Promise<void> {
    await this.area.set({ [SettingsStore.KEY]: settings });
  }
}

/** Checks a stored settings record field by field. */
class SettingsReader {
  /**
   * The record in a stored value.
   * @param raw the stored value
   * @returns the record
   * @throws Error "settings.<field> ..." for a missing or unknown value
   */
  static read(raw: unknown): Settings {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      throw new Error("settings is not an object");
    }
    const record = raw as Record<string, unknown>;
    return {
      theme: SettingsReader.theme(record.theme, "settings.theme"),
      cardWidth: SettingsReader.cardWidth(record.cardWidth, "settings.cardWidth"),
      panelPinned: SettingsReader.flag(record.panelPinned, "settings.panelPinned"),
      newTabPage: SettingsReader.flag(record.newTabPage, "settings.newTabPage"),
    };
  }

  /**
   * A theme.
   * @param raw the stored value
   * @param where its name for the error
   * @returns the theme
   * @throws Error when the value is not a theme
   */
  static theme(raw: unknown, where: string): Theme {
    const theme = THEMES.find((t) => t === raw);
    if (theme === undefined) {
      throw new Error(`${where} is not a theme: ${JSON.stringify(raw)}`);
    }
    return theme;
  }

  /**
   * A card width.
   * @param raw the stored value
   * @param where its name for the error
   * @returns the width
   * @throws Error when the value is not a step of the bar
   */
  static cardWidth(raw: unknown, where: string): CardWidth {
    const width = CARD_WIDTHS.find((w) => w === raw);
    if (width === undefined) {
      throw new Error(`${where} is not a card width: ${JSON.stringify(raw)}`);
    }
    return width;
  }

  /**
   * A yes/no choice.
   * @param raw the stored value
   * @param where its name for the error
   * @returns the choice
   * @throws Error when the value is not a boolean
   */
  static flag(raw: unknown, where: string): boolean {
    if (typeof raw !== "boolean") {
      throw new Error(`${where} is not a boolean: ${JSON.stringify(raw)}`);
    }
    return raw;
  }
}

/** The four keys that held the settings up to Tabuzaur 0.8. */
class LegacySettings {
  private static readonly THEME = "tabuzaur-theme";
  private static readonly CARD_WIDTH = "tabuzaur-card-size";
  private static readonly PINNED = "tabuzaur-sidebar-pinned";
  private static readonly NEW_TAB = "tabuzaur-open-in-new-tab";
  private static readonly KEYS = [LegacySettings.THEME, LegacySettings.CARD_WIDTH, LegacySettings.PINNED, LegacySettings.NEW_TAB];

  /**
   * Creates the reader.
   * @param area the key-value area
   */
  constructor(private readonly area: KeyValueArea) {}

  /**
   * Whether any of the old keys holds a value.
   * @returns true when there is something to move
   */
  async exists(): Promise<boolean> {
    for (const key of LegacySettings.KEYS) {
      const value = await this.value(key);
      if (value !== undefined) {
        return true;
      }
    }
    return false;
  }

  /**
   * The settings in the old keys; a key that was never saved gives the default.
   * @returns the record
   * @throws Error naming the key, when it holds a value it does not know
   */
  async read(): Promise<Settings> {
    const defaults = SettingsStore.DEFAULTS;
    const theme = await this.value(LegacySettings.THEME);
    const width = await this.value(LegacySettings.CARD_WIDTH);
    const pinned = await this.value(LegacySettings.PINNED);
    const newTab = await this.value(LegacySettings.NEW_TAB);
    return {
      theme: theme === undefined ? defaults.theme : SettingsReader.theme(theme, LegacySettings.THEME),
      cardWidth: width === undefined ? defaults.cardWidth : SettingsReader.cardWidth(width, LegacySettings.CARD_WIDTH),
      panelPinned: pinned === undefined ? defaults.panelPinned : SettingsReader.flag(pinned, LegacySettings.PINNED),
      newTabPage: newTab === undefined ? defaults.newTabPage : SettingsReader.flag(newTab, LegacySettings.NEW_TAB),
    };
  }

  /** Removes the old keys. */
  async remove(): Promise<void> {
    await this.area.remove([...LegacySettings.KEYS]);
  }

  /**
   * The value under one key.
   * @param key the key
   * @returns the value, undefined when the key is empty
   */
  private async value(key: string): Promise<unknown> {
    const items = await this.area.get(key);
    return items[key];
  }
}
