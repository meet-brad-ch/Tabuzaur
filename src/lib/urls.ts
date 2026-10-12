/**
 * The host of a URL without a leading "www.", or the scheme ("chrome", "file") when the URL has
 * no host. An unparsable URL is an error: every URL here came from Chrome.
 */
export function hostnameOf(url: string): string {
  const parsed = new URL(url);
  const host = parsed.hostname.replace(/^www\./, "");
  return host === "" ? parsed.protocol.replace(/:$/, "") : host;
}

/** The first character of the host, upper-cased: the favicon placeholder. */
export function initialOf(url: string): string {
  return hostnameOf(url).charAt(0).toUpperCase();
}

/** A hue in [0, 360) derived from the text, the same for the same text: colors a placeholder. */
export function hueOf(text: string): number {
  let hash = 0;
  for (const char of text) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 360;
  }
  return hash;
}
