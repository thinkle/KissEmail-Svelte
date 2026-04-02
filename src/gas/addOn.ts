export function getAddOnEnvironment(): "Sheets" | "Unknown" {
  if (typeof SpreadsheetApp !== "undefined" && SpreadsheetApp.getUi()) {
    return "Sheets";
  } else {
    return "Unknown";
  }
}

export function onOpen(_e: GoogleAppsScript.Events.SheetsOnOpen) {
  const addOnType = getAddOnEnvironment();
  if (addOnType === "Sheets") {
    SpreadsheetApp.getUi()
      .createAddonMenu()
      .addItem("Configure Mail Merge", "showSidebar")
      .addItem("Edit Email Template", "showDialog")
      .addItem("Run Mail Merge", "runMailMerge")
      .addSeparator()
      .addItem("About KISS Mail Merge", "showAbout")
      .addToUi();
  }
}

export function onInstall(e: GoogleAppsScript.Events.AppsScriptEvent) {
  onOpen(e as GoogleAppsScript.Events.SheetsOnOpen);
}
