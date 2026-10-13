# tools

`render/` renders the Tabuzaur page headless and writes the pictures that `help.html` and the
README use. `harness.html` stands in for Chrome's extension runtime with a fake `chrome.*` API and
seeded collections and open tabs. The URL hash picks a state. `shoot.mjs` runs headless Chrome
once per state, checks that every picture `help.html` names exists, and joins three frames into
`demo.gif` with `gif.py` (Python with Pillow). Run `npm run build` and then `npm run shots`.
`showcase-backup.json` holds the same seeded collections as a file you can import into a real
Tabuzaur, for screenshots taken in Chrome.
