import { ChromeTabBrowser } from "../lib/tabs.ts";

/** The popup is one button: open the Tabuzaur page, or jump to it when it is already open. */
const app = document.getElementById("app");
if (app === null) {
  throw new Error("popup.html has no #app element");
}
const open = document.createElement("button");
open.type = "button";
open.textContent = "Open Tabuzaur";
open.addEventListener("click", () => {
  new ChromeTabBrowser().jumpTo(chrome.runtime.getURL("tabs.html")).then(
    () => {
      window.close();
    },
    (error: unknown) => {
      app.textContent = error instanceof Error ? error.message : String(error);
    },
  );
});
app.replaceChildren(open);
