/** Text derived from a URL for display: the host, its initial, a stable color. */
export class UrlText {
  /**
   * The host of a URL without a leading "www.", or the scheme ("chrome", "file") when the URL has
   * no host.
   * @param url an absolute URL; every URL here came from Chrome or passed validation
   * @returns the display host
   * @throws Error when the URL does not parse
   */
  static hostname(url: string): string {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "") {
      return parsed.protocol.replace(/:$/, "");
    }
    return host;
  }

  /**
   * The first character of the host, upper-cased: the favicon placeholder.
   * @param url an absolute URL
   * @returns one character
   * @throws Error when the URL does not parse
   */
  static initial(url: string): string {
    const host = UrlText.hostname(url);
    return host.charAt(0).toUpperCase();
  }

  /**
   * A hue in [0, 360) derived from the text, the same for the same text: colors a placeholder.
   * @param text any text, usually a host
   * @returns a hue in degrees, 0 to 359
   */
  static hue(text: string): number {
    let hash = 0;
    for (const char of text) {
      const code = char.codePointAt(0) ?? 0;
      hash = (hash * 31 + code) % 360;
    }
    return hash;
  }
}
