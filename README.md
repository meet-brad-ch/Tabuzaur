# Tabuzaur

**What:** A Chrome extension (Manifest V3) for organizing the pages you work with into
collections, starting from the tabs that are open. Its page shows every open tab in a sidebar and
your hand-made collections next to it; drag a tab onto a collection to keep it there as a link.
Clicking a saved link jumps to the tab when it is open and opens the page otherwise. Everything is
kept in `chrome.storage.local` on the machine; nothing is synced or sent anywhere.

**Why:** Privacy, and a mix that bookmarks and tab managers do not offer: organizing happens while
the pages are open as tabs, and the saved links stay linked to those tabs. Existing managers sync
collections through their own cloud or a Google account. Tabuzaur keeps everything local, with no
network access and no account.

**Status:** partly working — the page and the popup are built and pass the gate; the owner's
hands-on test in Chrome is the next step.

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
`chrome-extension://<id>/tabs.html`. The toolbar button opens the same page at any time.

**Verify:** `npm run verify`

**Prerequisites:** Node 24, npm 11, Chrome 116 or newer.

## Layout

- `public/manifest.json` — the extension manifest, copied verbatim into `dist/`
- `tabs.html`, `src/tabs/` — the Tabuzaur page: open-tab sidebar, collection cards, drag and drop
- `popup.html`, `src/popup/` — the toolbar popup: one button that opens or jumps to the page
- `src/lib/` — collection model and operations (`CollectionBook`), the local store and its parser, the Chrome tab adapter
- `tests/` — Vitest unit tests of `src/lib/` with in-memory fakes (no browser needed)
- `.github/workflows/build.yml` — CI: runs the verify gate, zips `dist/`, publishes a Release on a `v*` tag

## Decisions

One line each: the choice, and the reason it was made. Append; do not rewrite history.

- 2026-10-12 — Manifest V3 without a background service worker: nothing has to run while no Tabuzaur page is open.
- 2026-10-12 — TypeScript + Vite + Vitest + ESLint, plain Vite with fixed entry names instead of a CRX plugin: fewer moving parts to maintain.
- 2026-10-12 — Data stays in `chrome.storage.local`, permissions `tabs` and `storage` only: the reason the project exists.
- 2026-10-12 — Pure logic in `src/lib/` behind adapter interfaces, Chrome API only in thin adapters: tests run in Node with fakes.
- 2026-10-12 — The release zip is built only by CI from a `v<manifest version>` tag; a tag that does not match the manifest fails the build.
- 2026-10-12 — Collections are hand-made folders of links, not window snapshots: the owner organizes pages one by one while they are open; the whole-window save was built first and dropped.
- 2026-10-12 — Dropping a tab keeps it open; a link already in that collection is refused with a visible notice, never ignored.
- 2026-10-12 — A saved link jumps to the open tab with exactly that URL, else opens a new tab: the collection stays a bookmark-like list.
- 2026-10-12 — Welcome page by Chrome's startup setting, not `chrome_url_overrides.newtab`: the owner opts in, Ctrl+T stays Chrome's.

---

Keep this file honest: it is the only project document that is committed. `LOG.md` is
gitignored, so anything that must survive a fresh clone belongs here, not in the log.
