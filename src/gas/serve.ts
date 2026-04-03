const IDX = "index.html";
const APPNAME = "KISS Mail Merge";

import { getAddOnEnvironment } from "./addOn";
import { getSheetShell } from "./kissMailMerge";

function withAppContext(context: Record<string, unknown>) {
  return JSON.stringify(context);
}

export function doGet(e) {
  const template = HtmlService.createTemplateFromFile(IDX);
  const view = e?.parameter?.view === "editor" ? "editor" : "sidebar";
  template.appContext = withAppContext({
    addOn: "Unknown",
    container: view === "editor" ? "dialog" : "sidebar",
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
    view: "sidebar",
    initialSheetShell: getSheetShell(),
  });
  const html = template.evaluate().setTitle(APPNAME);
  SpreadsheetApp.getUi().showSidebar(html);
}

export function showAbout() {
  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: "Segoe UI", Roboto, Arial, sans-serif; font-size: 13px;
             color: #1f2937; padding: 16px 20px; line-height: 1.5; }
      h2   { margin: 0 0 4px; font-size: 1.1rem; }
      p    { margin: 0 0 10px; }
      ul   { margin: 0 0 10px; padding-left: 18px; }
      li   { margin-bottom: 4px; }
      .tagline { color: #6b7280; font-style: italic; margin-bottom: 14px; }
    </style>
    <h2>💋 KISS Mail Merge</h2>
    <p class="tagline">Keep It Simple, Stupid.</p>
    <p>
      A mail merge add-on that lives entirely in your Google Sheet —
      no third-party accounts, no per-email fees, no export required.
    </p>
    <ul>
      <li><strong>Edit email right from Sheets</strong> — rich-text editor built in.</li>
      <li><strong>Sends with your Google account</strong> — recipients see mail from you, not a bulk-mail service.</li>
      <li><strong>No artificial limits</strong> — subject to Google's own daily quota, that's all.</li>
      <li><strong>Config lives in the spreadsheet</strong> — power users can generate merge settings as data, script them, or version-control them alongside the sheet.</li>
      <li><strong>Optional open-tracking</strong> — 1×1 pixel via a Cloudflare Worker; false negatives and false positives are a fact of life, but it's better than nothing.</li>
    </ul>
    <p style="color:#6b7280;font-size:0.85em;margin-top:16px;">
      Made with ❤ and zero VC funding.
    </p>
  `)
    .setWidth(420)
    .setHeight(340);
  SpreadsheetApp.getUi().showModalDialog(html, `About ${APPNAME}`);
}

export function showDialog(title: string = APPNAME, modal = true) {
  const template = HtmlService.createTemplateFromFile(IDX);
  template.appContext = withAppContext({
    addOn: "Sheets",
    container: "dialog",
    mode: modal ? "modal" : "modeless",
    view: "editor",
    initialSheetShell: getSheetShell(),
  });
  const html = template.evaluate().setWidth(960).setHeight(720);
  if (modal) {
    SpreadsheetApp.getUi().showModalDialog(html, title);
  } else {
    SpreadsheetApp.getUi().showModelessDialog(html, title);
  }
}
