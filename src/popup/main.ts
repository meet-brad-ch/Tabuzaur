const app = document.getElementById("app");
if (app === null) {
  throw new Error("popup.html has no #app element");
}
app.textContent = "Tabuzaur";
