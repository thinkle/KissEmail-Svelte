const IDX = "index.html";
const APPNAME = "KISS Mail Merge";

import { getAddOnEnvironment } from "./addOn";

export function doGet(e) {
  const template = HtmlService.createTemplateFromFile(IDX);
  const view = e?.parameter?.view === "editor" ? "editor" : "sidebar";
  template.appContext = JSON.stringify({
    addOn: "Unknown",
    container: view === "editor" ? "dialog" : "sidebar",
    view,
    localTesting: true,
  });
  return template.evaluate();
}

export function showSidebar() {
  const template = HtmlService.createTemplateFromFile(IDX);
  template.appContext = JSON.stringify({
    addOn: "Sheets",
    container: "sidebar",
    view: "sidebar",
  });
  const html = template.evaluate().setTitle(APPNAME);
  SpreadsheetApp.getUi().showSidebar(html);
}

export function showDialog(title: string = APPNAME, modal = true) {
  const template = HtmlService.createTemplateFromFile(IDX);
  template.appContext = JSON.stringify({
    addOn: "Sheets",
    container: "dialog",
    mode: modal ? "modal" : "modeless",
    view: "editor",
  });
  const html = template.evaluate().setWidth(960).setHeight(720);
  if (modal) {
    SpreadsheetApp.getUi().showModalDialog(html, title);
  } else {
    SpreadsheetApp.getUi().showModelessDialog(html, title);
  }
}
