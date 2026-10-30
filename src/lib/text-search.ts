/** The pieces of a text around its first match of a query. */
export interface TextMatch {
  readonly before: string;
  readonly match: string;
  readonly after: string;
}

/** Case-insensitive substring search, used for the search fields and their highlights. */
export class TextSearch {
  /**
   * Whether the text contains the query, ignoring case; a blank query matches nothing.
   * @param text the text to search
   * @param query the typed query; surrounding spaces are ignored
   * @returns true when the text contains the query
   */
  static contains(text: string, query: string): boolean {
    return TextSearch.firstMatch(text, query) !== undefined;
  }

  /**
   * The text split around the first case-insensitive match, keeping the original case.
   * @param text the text to search
   * @param query the typed query; surrounding spaces are ignored
   * @returns the three pieces, or undefined when there is no match or the query is blank
   */
  static firstMatch(text: string, query: string): TextMatch | undefined {
    const needle = query.trim().toLowerCase();
    if (needle === "") {
      return undefined;
    }
    const at = text.toLowerCase().indexOf(needle);
    if (at < 0) {
      return undefined;
    }
    const end = at + needle.length;
    return { before: text.slice(0, at), match: text.slice(at, end), after: text.slice(end) };
  }
}
