# Tabuzaur

*Tame your tabs.*

**What:** A Chrome extension (Manifest V3) for organizing the pages you work with into
collections, starting from the tabs that are open. Its page shows every open tab in a sidebar and
your hand-made collections next to it; drag a tab onto a collection to keep it there as a link.
Clicking a saved link jumps to the tab when it is open and opens the page otherwise. Everything is
kept in `chrome.storage.local` on the machine; nothing is synced or sent anywhere.

**Why:** Privacy, and a mix that bookmarks and tab managers do not offer: organizing happens while
the pages are open as tabs, and the saved links stay linked to those tabs. Existing managers sync
collections through their own cloud or a Google account. Tabuzaur keeps everything local, with no
network access and no account.

**Status:** working — the page, the toolbar button and Alt+T are tested by hand in Chrome;
`npm run verify` is green; releases are built by CI from a `v*` tag.

## How to run

Prerequisites: Node 24.19.0 and npm 11.17.0 (the versions this was built with), Chrome.

```
npm ci                 # install the pinned toolchain
npm run build          # vite build -> dist/ (the unpacked extension)
npm run verify         # eslint + tsc --noEmit + vitest + vite build
```

Load it in Chrome: `chrome://extensions` → Developer mode → Load unpacked → the `dist/` folder.
After a rebuild, click the reload icon on the extension card.

Make it the welcome page: copy the extension ID from its card on `chrome://extensions`, then in
Chrome Settings → On startup → "Open a specific page or set of pages" add
`chrome-extension://<id>/tabs.html`. The toolbar button and **Alt+T** open the same page at any
time; the key can be changed on `chrome://extensions/shortcuts`.

**Verify:** `npm run verify`

**Prerequisites:** Node 24, npm 11, Chrome 116 or newer.

## Layout

- `public/manifest.json` — the extension manifest, copied verbatim into `dist/`
- `tabs.html`, `src/tabs/` — the Tabuzaur page: open-tab sidebar, collection cards, drag and drop
- `src/background.ts` — the service worker: the toolbar button opens or jumps to the page
- `src/lib/` — collection model and operations (`CollectionBook`), the local store and its parser, the Chrome tab adapter
- `tests/` — Vitest unit tests of `src/lib/` with in-memory fakes (no browser needed)
- `.github/workflows/build.yml` — CI: runs the verify gate, zips `dist/`, publishes a Release on a `v*` tag
- `branding/` — the brand showcase (mascot, wordmark, app icons) and the mascot cut from it, which the `public/icons/` set is resized from
- `public/icons/` — the extension icons (16, 32, 48, 128), also the page's favicon and header logo

## Design

- Manifest V3. The only background code is a module service worker that handles the toolbar
  click and the Alt+T command; nothing runs while no Tabuzaur page is open.
- Permissions are `tabs` and `storage`. All data lives in `chrome.storage.local`; there is no
  sync, no account and no network request, not even for a font (Inter when installed, else
  Segoe UI or the system font).
- A collection is a hand-made folder of links. Dropping a tab keeps the tab open; a link already
  in that collection is refused with a visible notice. Clicking a link activates the open tab with
  exactly that URL, or opens a new tab.
- The welcome page is Chrome's startup-page setting, not a new-tab override, so Ctrl+T stays
  Chrome's and the owner opts in.
- Pure logic (collections, store parser, URL helpers, theme store) sits in `src/lib/` behind
  adapter interfaces and is unit-tested in Node with fakes; the Chrome API is touched only in thin
  adapters, and the DOM code in `src/tabs/` is tested by hand in Chrome.
- TypeScript + Vite + Vitest + ESLint, plain Vite with fixed entry names instead of a CRX plugin.
- Releases are built only by CI from a `v<manifest version>` tag; a tag that does not match the
  manifest, or a manifest that does not match `package.json`, fails the run before anything is built.
- Brand, from `branding/showcase.png`: navy `#0f283d`, green `#0a8d73` (wordmark) and `#36b88f`
  (mascot), mint `#dbf5ec`, tagline grey `#506f85`; the mascot on a transparent background is the
  extension icon and the header logo.

---

Keep this file honest: it is the only project document that is committed. `LOG.md` is
gitignored, so anything that must survive a fresh clone belongs here, not in the log.
