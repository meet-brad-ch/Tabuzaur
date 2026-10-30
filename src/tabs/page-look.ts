import type { CardSize, Theme } from "../lib/storage.ts";

/** Puts the theme and the card width on the document element, where the stylesheet reads them. */
export class PageLook {
  private readonly darkSystem = window.matchMedia("(prefers-color-scheme: dark)");

  /**
   * Sets the theme; "system" resolves to the system's choice, so the stylesheet knows light and dark only.
   * @param theme the choice
   */
  applyTheme(theme: Theme): void {
    if (theme !== "system") {
      document.documentElement.dataset.theme = theme;
      return;
    }
    document.documentElement.dataset.theme = this.darkSystem.matches ? "dark" : "light";
  }

  /**
   * Sets the least width of a card.
   * @param size the choice
   */
  applyCardSize(size: CardSize): void {
    document.documentElement.dataset.size = size;
  }

  /**
   * Calls the listener when the system switches between light and dark.
   * @param listener the callback
   */
  onSystemChange(listener: () => void): void {
    this.darkSystem.addEventListener("change", listener);
  }
}
