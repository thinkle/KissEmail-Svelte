/* Set up a mock for the little sidebar window and/or dialog
  so it looks vaguely like a real add-on when testing in 
  a local browser.

  This is some simple vanilla JS for handling that "outer" 
  environment.
*/
import { DEFAULT_CONTEXT } from "../context";
import {
  MOCK_SCENARIOS,
  getMockScenarioDefinition,
  getMockScenarioId,
  setStoredMockScenario,
} from "./mockScenarios";

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
const scenarioSelect = document.querySelector("#scenario");
const scenarioDescription = document.querySelector("#scenario-description");

function updateScenarioMeta(scenarioId = getMockScenarioId()) {
  const scenario = getMockScenarioDefinition(scenarioId);
  if (scenarioSelect) {
    scenarioSelect.value = scenario.id;
  }
  if (scenarioDescription) {
    scenarioDescription.textContent = scenario.description;
  }
}

function setView(view = "sidebar", scenarioId = getMockScenarioId()) {
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
  url.searchParams.set("scenario", scenarioId);
  iframe.src = url.toString();
  const shellUrl = new URL(window.location.href);
  shellUrl.searchParams.set("view", nextView);
  shellUrl.searchParams.set("scenario", scenarioId);
  window.history.replaceState({}, "", shellUrl);
  updateScenarioMeta(scenarioId);
}

if (scenarioSelect) {
  MOCK_SCENARIOS.forEach((scenario) => {
    const option = document.createElement("option");
    option.value = scenario.id;
    option.textContent = scenario.label;
    scenarioSelect.append(option);
  });

  scenarioSelect.addEventListener("change", (event) => {
    const nextScenario = event.currentTarget.value;
    setStoredMockScenario(nextScenario);
    setView(DEFAULT_CONTEXT.view === "editor" ? "editor" : "sidebar", nextScenario);
  });
}

const initialUrl = new URL(window.location.href);
const initialView = initialUrl.searchParams.get("view") === "editor" ? "editor" : "sidebar";
setView(initialView, getMockScenarioId());

window.addEventListener("message", (event) => {
  if (event.data?.type === "kiss-mail-merge:open-dialog") {
    setView("editor", getMockScenarioId());
  }
});

let sideButton = document.querySelector("#sidebar");
let dialogButton = document.querySelector("#dialog");

if (sideButton) {
  sideButton.addEventListener("click", () => {
    setView("sidebar", getMockScenarioId());
  });
}
if (dialogButton) {
  dialogButton.addEventListener("click", () => {
    setView("editor", getMockScenarioId());
  });
}
