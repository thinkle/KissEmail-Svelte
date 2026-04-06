const IDX = "index.html";
const APPNAME = "KISS Mail Merge";

import { getAddOnEnvironment } from "./addOn";
import { getSheetShell } from "./kissMailMerge";

function withAppContext(context: Record<string, unknown>) {
  return JSON.stringify(context);
}

export function doGet(e) {
  const template = HtmlService.createTemplateFromFile(IDX);
  const requestedView = String(e?.parameter?.view ?? "");
  const view =
    requestedView === "about"
      ? "about"
      : requestedView === "templateEditor" || requestedView === "editor"
        ? "templateEditor"
        : "editor";

  template.appContext = withAppContext({
    addOn: "Unknown",
    container: view === "editor" ? "sidebar" : "dialog",
    view,
    localTesting: true,
  });
  return template.evaluate();
}

export function showSidebar() {
  const template = HtmlService.createTemplateFromFile(IDX);
  template.appContext = withAppContext({
    addOn: "Sheets",
    container: "sidebar",
    view: "editor",
    initialSheetShell: getSheetShell(),
  });
  const html = template.evaluate().setTitle(APPNAME);
  SpreadsheetApp.getUi().showSidebar(html);
}

export function showAbout() {
  const template = HtmlService.createTemplateFromFile(IDX);
  template.appContext = withAppContext({
    addOn: "Sheets",
    container: "dialog",
    view: "about",
  });

  const html = template.evaluate().setWidth(520).setHeight(560);
  SpreadsheetApp.getUi().showModalDialog(html, `About ${APPNAME}`);
}

export function showDialog(title: string = APPNAME, modal = true) {
  const template = HtmlService.createTemplateFromFile(IDX);
  template.appContext = withAppContext({
    addOn: "Sheets",
    container: "dialog",
    mode: modal ? "modal" : "modeless",
    view: "templateEditor",
    initialSheetShell: getSheetShell(),
  });
  const html = template.evaluate().setWidth(960).setHeight(720);
  if (modal) {
    SpreadsheetApp.getUi().showModalDialog(html, title);
  } else {
    SpreadsheetApp.getUi().showModelessDialog(html, title);
  }
}
