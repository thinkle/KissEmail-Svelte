/* Set up a mock for the little sidebar window and/or dialog
  so it looks vaguely like a real add-on when testing in 
  a local browser.

  This is some simple vanilla JS for handling that "outer" 
  environment.
*/
import { DEFAULT_CONTEXT } from "../context";

export function setContext(context = {}) {
  Object.assign(DEFAULT_CONTEXT, context);
  let main = document.querySelector("main");
  main?.setAttribute("class", "");
  if (main) main.classList.add(DEFAULT_CONTEXT.addOn);
  let div = document.querySelector("div");
  div?.setAttribute("class", "");
  if (div) {
    div.classList.add(DEFAULT_CONTEXT.container);
    if (DEFAULT_CONTEXT.mode) {
      div.classList.add(DEFAULT_CONTEXT.mode);
    }
  }

  document.querySelector(".app").textContent = DEFAULT_CONTEXT.addOn;
}

const iframe = document.querySelector("iframe");

function setView(view = "sidebar") {
  const nextView = view === "editor" ? "editor" : "sidebar";
  setContext({
    container: nextView === "editor" ? "dialog" : "sidebar",
    view: nextView,
  });

  if (!iframe) {
    return;
  }

  const url = new URL(iframe.getAttribute("src") || "../index.html", window.location.href);
  url.searchParams.set("view", nextView);
  iframe.src = url.toString();
}

setView("sidebar");

window.addEventListener("message", (event) => {
  if (event.data?.type === "kiss-mail-merge:open-dialog") {
    setView("editor");
  }
});

let sideButton = document.querySelector("#sidebar");
let dialogButton = document.querySelector("#dialog");

if (sideButton) {
  sideButton.addEventListener("click", () => {
    setView("sidebar");
  });
}
if (dialogButton) {
  dialogButton.addEventListener("click", () => {
    setView("editor");
  });
}
