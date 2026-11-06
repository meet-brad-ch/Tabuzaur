# Changelog

What changed in each release. Each release on GitHub shows its section. Before 0.9.0, a card was
called a collection.

## 0.9.3 (2026-11-06)

- A click on a saved link goes to the tab with exactly its address. When no such tab is open, it
  goes to the tab you used last on the same site, and leaves that page as it is.
- New box **Reuse a tab on the same site** in the link editor. Clear it for sites where each
  address is a different account, for example Gmail. Such a link opens only its own tab, and its
  row shows "own tab".
- Backups keep the box for each link.

## 0.9.2 (2026-11-05)

- Spring-loaded tabs: hold a dragged link or card on a closed collection tab for a moment, and
  the collection opens. You can then drop on a card there.
- A card dropped on a card of another collection lands at that place.

## 0.9.1 (2026-10-30)

- Collection tabs are folder tabs. They overlap, and the open tab lies on top and joins the cards.
- Each collection has its own color. A new collection gets a color that differs clearly from the
  tab before it.

## 0.9.0 (2026-10-30)

- Links sit in cards, and cards sit in collections. A bar under the header has one tab per
  collection.
- The + at the end of the bar creates a collection. The pen or a double click renames it. Drag a
  tab to change the order. The trash deletes an empty collection. The last collection stays.
- Drag a card onto a tab to move it to that collection.
- Search filters the open collection. Each tab shows how many of its cards match.
- Data from 0.8 becomes one collection named Main on the first load. Tabuzaur keeps a copy of the
  old data. A backup from 0.8 imports into the open collection.
- Tabuzaur 0.8 and earlier cannot read a backup from this version.

## 0.8.0 (2026-10-27)

- With the new-tab option on, Ctrl+T goes to the Tabuzaur tab of the window instead of opening a
  copy.
- A window keeps one Tabuzaur tab. When one is active, its copies in that window close.

## 0.7.1 (2026-10-21)

- The logo and the name in the header link to the project on GitHub.

## 0.7.0 (2026-10-16)

- A narrow window shows fewer columns of cards, down to one.
- Settings has a card width bar with three steps: Small, Medium and Large.

## 0.6.1 (2026-10-16)

- The cards scroll while a drag rests near their top or bottom edge.
- The page keeps its scroll position after a drop.

## 0.6.0 (2026-10-14)

- New option in Settings: open Tabuzaur in every new tab. It is off by default.

## 0.5.1 (2026-10-14)

- The chrome:// addresses in the help page open their page when you click them.

## 0.5.0 (2026-10-14)

- A help page with pictures. It opens once after install and from the ? button in the header.
- The icon buttons have labels for screen readers.
- MIT license.

## 0.4.2 (2026-10-13)

- The open-tab panel is as tall as the page.

## 0.4.1 (2026-10-13)

- The open-tab panel folds away while you drag a tab out of it.

## 0.4.0 (2026-10-12)

- The open-tab panel is a flyout from a thin rail on the left. The pin keeps it open as a column.

## 0.3.0 (2026-10-12)

- Drag a card by its colored band to change the order. A line shows where it lands.
- Sixteen card colors. A card keeps its color.

## 0.2.1 (2026-10-12)

- The whole link row opens the link. The pen and the cross sit apart.
- In the link editor, Enter saves and Escape cancels.

## 0.2.0 (2026-10-12)

- Export and Import of a JSON backup. Import asks whether to replace or merge.
- The header shows the shortcut in effect, or a link to assign one.
- Drag a link up or down in its card. The link editor also changes the address.

## 0.1.0 (2026-10-12)

- The Tabuzaur page: cards of saved links, filled by dragging from the panel of open tabs.
- A click on a link jumps to its open tab, or opens it in a new tab.
- Drag a link to another card. Rename, color and delete cards. Edit the title of a link.
- Search marks the matching links and names.
- The toolbar button and Alt+T open the page. Light and dark themes.
- Everything stays in Chrome's local storage.
