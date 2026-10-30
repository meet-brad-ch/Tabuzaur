# tools

`render/` renders the Tabuzaur page headless and writes the pictures that `help.html` and the
README use. `harness.html` stands in for Chrome's extension runtime with a fake `chrome.*` API: a
schema 2 library with two collections (Main with four cards, Later with one), the settings record
and open tabs. The URL hash picks a state; the state `v1` seeds a document of Tabuzaur 0.8 instead,
to show the upgrade. `shoot.mjs` runs headless Chrome once per state, checks that every picture
`help.html` names exists, and joins three frames into `demo.gif` with `gif.py` (Python with
Pillow). Run `npm run build` and then `npm run shots`.

`check.mjs` drives the built page through the harness over the Chrome DevTools protocol and checks
what the unit tests on happy-dom cannot: real drag events, the focus, the fake storage after each
action, and the upgrade of an old document. It prints one line per check and fails when one fails.
Run `npm run build` and then `npm run check:page`.

`showcase-backup.json` holds the same seeded library as a file you can import into a real
Tabuzaur, for screenshots taken in Chrome.
