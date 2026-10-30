import { THEMES } from "../lib/settings.ts";
import type { Theme } from "../lib/settings.ts";
import { Dom, Icons } from "./dom.ts";
import type { IconName } from "./dom.ts";
import type { PageActions } from "./page-actions.ts";
import type { PageState } from "./page-state.ts";
import { SettingsDialog } from "./settings-dialog.ts";

/** The header: brand, search, the create field, Export and Import, theme, settings and help. */
export class HeaderView {
  private static readonly REPO_URL = "https://github.com/meet-brad-ch/Tabuzaur";

  /**
   * Creates the view.
   * @param state the page state
   * @param actions the page actions
   */
  constructor(private readonly state: PageState, private readonly actions: PageActions) {}

  /**
   * Builds the header.
   * @returns the header element
   */
  build(): HTMLElement {
    const header = Dom.el("header", "top");
    // the tools wrap as one group under the brand and the search when the window is narrow
    const tools = Dom.el("div", "tools");
    const icons = Dom.el("div", "icons");
    icons.append(this.themeButton(), this.settingsButton(), this.helpButton());
    tools.append(this.createForm(), this.backupButtons(), icons);
    header.append(this.brand(), this.searchField(), tools);
    return header;
  }

  /**
   * The logo and the name, linking to the project, and the shortcut badge next to them.
   * @returns the brand element
   */
  private brand(): HTMLElement {
    const brand = Dom.el("div", "brand");
    const logo = Dom.el("img", "logo") as HTMLImageElement;
    logo.src = "icons/icon-128.png";
    logo.alt = "";
    const words = Dom.el("div", "words");
    const title = Dom.el("h1");
    const tabu = Dom.el("span", "tabu");
    tabu.textContent = "Tabu";
    const zaur = Dom.el("span", "zaur");
    zaur.textContent = "zaur";
    title.append(tabu, zaur);
    const tagline = Dom.el("span", "tagline");
    tagline.textContent = "Tame your tabs";
    words.append(title, tagline);
    // the shortcut badge can be a button, so it stays outside the link
    const home = Dom.el("a", "home") as HTMLAnchorElement;
    home.href = HeaderView.REPO_URL;
    home.target = "_blank";
    home.rel = "noopener";
    home.title = "Tabuzaur on GitHub";
    home.append(logo, words);
    brand.append(home, this.shortcutBadge());
    return brand;
  }

  /**
   * The assigned key, or, when Chrome assigned none, a button to its shortcut settings.
   * @returns a kbd element or a button
   */
  private shortcutBadge(): HTMLElement {
    if (this.state.shortcut !== "") {
      const key = Dom.el("kbd", "shortcut");
      key.textContent = this.state.shortcut;
      key.title = "Opens Tabuzaur from any tab";
      return key;
    }
    const hint = Dom.textButton("shortcut unset", "No shortcut assigned - set one", () => {
      this.actions.openShortcuts();
    });
    Dom.labelled(hint, "Chrome assigns Alt+T only when no other extension uses it; pick a key on chrome://extensions/shortcuts");
    return hint;
  }

  /**
   * The search field over cards and links.
   * @returns the labelled field
   */
  private searchField(): HTMLElement {
    const search = Dom.el("label", "field search");
    const input = Dom.input("search");
    input.placeholder = "Search collections and links";
    input.value = this.state.query;
    input.addEventListener("input", () => {
      this.actions.search(input.value);
    });
    search.append(Icons.icon("search"), input);
    return search;
  }

  /**
   * The field that creates a card.
   * @returns the form
   */
  private createForm(): HTMLElement {
    const form = Dom.el("form", "field create") as HTMLFormElement;
    const name = Dom.input("text");
    name.placeholder = "New collection";
    name.required = true;
    const create = Dom.el("button", "primary") as HTMLButtonElement;
    create.type = "submit";
    create.append(Icons.icon("plus"), Dom.text("Create"));
    form.append(name, create);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.actions.createCard(name.value);
    });
    return form;
  }

  /**
   * Export downloads everything as JSON; Import reads such a file through a hidden file picker.
   * @returns the button group
   */
  private backupButtons(): HTMLElement {
    const group = Dom.el("div", "backup");
    const exportButton = Dom.button("ghost", () => {
      this.actions.exportBackup();
    });
    exportButton.append(Icons.icon("download"), Dom.text("Export"));
    const picker = Dom.input("file");
    picker.accept = ".json,application/json";
    picker.hidden = true;
    picker.addEventListener("change", () => {
      const file = picker.files?.[0];
      picker.value = "";
      if (file !== undefined) {
        this.actions.importFile(file);
      }
    });
    const importButton = Dom.button("ghost", () => {
      picker.click();
    });
    importButton.append(Icons.icon("upload"), Dom.text("Import"));
    group.append(exportButton, importButton, picker);
    return group;
  }

  /**
   * The round button that cycles the theme; its icon shows the current one.
   * @returns the button
   */
  private themeButton(): HTMLElement {
    const icons: Record<Theme, IconName> = { system: "auto", light: "sun", dark: "moon" };
    const labels: Record<Theme, string> = { system: "Theme: follows the system", light: "Theme: light", dark: "Theme: dark" };
    const toggle = Dom.button("icon theme", () => {
      this.actions.cycleTheme();
    });
    toggle.append(Icons.icon(icons[this.state.settings.theme]));
    Dom.labelled(toggle, `${labels[this.state.settings.theme]} (click to change)`);
    return toggle;
  }

  /**
   * The gear that opens the settings dialog.
   * @returns the button
   */
  private settingsButton(): HTMLElement {
    const gear = Dom.button("icon settings", () => {
      new SettingsDialog(this.state, this.actions).open();
    });
    gear.append(Icons.icon("gear"));
    Dom.labelled(gear, "Settings");
    return gear;
  }

  /**
   * The question mark that opens the help page.
   * @returns the button
   */
  private helpButton(): HTMLElement {
    const help = Dom.button("icon help", () => {
      this.actions.openHelp();
    });
    help.append(Icons.icon("help"));
    Dom.labelled(help, "Help: how to install and use Tabuzaur");
    return help;
  }

  /**
   * The theme after the given one, in the order of THEMES.
   * @param theme the current theme
   * @returns the next theme
   */
  static nextTheme(theme: Theme): Theme {
    const index = THEMES.indexOf(theme);
    const next = THEMES[(index + 1) % THEMES.length];
    if (next === undefined) {
      throw new Error(`no theme after ${theme}`);
    }
    return next;
  }
}
