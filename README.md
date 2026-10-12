# Tabuzaur

**What:** A Chrome extension (Manifest V3) that saves the open tabs of a window as a named
collection, closes them if asked, and reopens the collection later. Everything is kept in
`chrome.storage.local` on the machine; nothing is synced or sent anywhere.

**Why:** Privacy. Existing tab managers sync collections through their own cloud or a Google
account. Tabuzaur keeps the saved tabs local only, with no network access and no account.

**Status:** scaffold only — README, gitignore and git exist; no code yet.

## How to run

Prerequisites: Node 24.19.0 and npm 11.17.0 (the versions this was built with), Chrome.

```
npm ci                 # install the pinned toolchain
npm run build          # vite build -> dist/ (the unpacked extension)
npm run verify         # eslint + tsc --noEmit + vitest + vite build
```

Load it in Chrome: `chrome://extensions` → Developer mode → Load unpacked → the `dist/` folder.
After a rebuild, click the reload icon on the extension card.

**Verify:** `npm run verify`

**Prerequisites:** Node 24, npm 11, Chrome with Manifest V3 support (any current Chrome).

## Layout

- `public/manifest.json` — the extension manifest, copied verbatim into `dist/`
- `popup.html` — Vite entry for the toolbar popup
- `src/popup/` — the popup UI (DOM only; calls the adapters in `src/lib/`)
- `src/lib/` — collection model, pure operations, the local store and the Chrome tab adapters
- `tests/` — Vitest unit tests with in-memory fakes (no browser needed)
- `.github/workflows/build.yml` — CI: runs the verify gate, zips `dist/`, publishes a Release on a `v*` tag

## Decisions

One line each: the choice, and the reason it was made. Append; do not rewrite history.

- 2026-10-12 — Manifest V3 popup without a background service worker: nothing has to run while the popup is closed.
- 2026-10-12 — TypeScript + Vite + Vitest + ESLint, plain Vite with fixed entry names instead of a CRX plugin: fewer moving parts to maintain.
- 2026-10-12 — Data stays in `chrome.storage.local`, permissions `tabs` and `storage` only: the reason the project exists.
- 2026-10-12 — Pure logic in `src/lib/` behind adapter interfaces, Chrome API only in thin adapters: tests run in Node with fakes.
- 2026-10-12 — The release zip is built only by CI from a `v<manifest version>` tag; a tag that does not match the manifest fails the build.

---

Keep this file honest: it is the only project document that is committed. `LOG.md` is
gitignored, so anything that must survive a fresh clone belongs here, not in the log.
