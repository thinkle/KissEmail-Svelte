import { checkReceipts } from "./kissMailMerge";
import { MAIL_MERGE_RECEIPT_ID_COLUMN } from "./mailMerge";

const CONFIG_SHEET_SUFFIX = " Mail Merge Config";

function getActiveDataSheet(): GoogleAppsScript.Spreadsheet.Sheet {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const active = spreadsheet.getActiveSheet();
  if (active.getName().endsWith(CONFIG_SHEET_SUFFIX)) {
    const sourceName = active.getName().slice(0, -CONFIG_SHEET_SUFFIX.length);
    const sourceSheet = spreadsheet.getSheetByName(sourceName);
    if (sourceSheet) return sourceSheet;
  }
  return active;
}

function hasConfigSheetFor(sheetName: string): boolean {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return Boolean(
    spreadsheet.getSheetByName(`${sheetName}${CONFIG_SHEET_SUFFIX}`),
  );
}

function hasAnyReceiptIds(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  headerRows = 1,
): boolean {
  const values = sheet.getDataRange().getValues();
  if (values.length <= headerRows) return false;

  const headerRow = values[headerRows - 1].map((v) => String(v ?? ""));
  const receiptIdColumn = headerRow.indexOf(MAIL_MERGE_RECEIPT_ID_COLUMN);
  if (receiptIdColumn < 0) return false;

  for (let row = headerRows; row < values.length; row++) {
    const receiptId = String(values[row][receiptIdColumn] ?? "").trim();
    if (receiptId) return true;
  }
  return false;
}

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
      .addItem("Check Receipts", "menuCheckReceipts")
      .addSeparator()
      .addItem("About KISS Mail Merge", "showAbout")
      .addToUi();
  }
}

export function menuCheckReceipts() {
  const ui = SpreadsheetApp.getUi();
  const sheet = getActiveDataSheet();

  if (!hasConfigSheetFor(sheet.getName())) {
    ui.alert(
      "No Mail Merge Setup Yet",
      "This sheet does not have a KISS Mail Merge setup yet.\n\nOpen Configure Mail Merge first, then send tracked emails before using Check Receipts.",
      ui.ButtonSet.OK,
    );
    return;
  }

  try {
    const result = checkReceipts(sheet.getName());
    if (
      result.checked === 0 &&
      result.received === 0 &&
      result.pending === 0 &&
      !hasAnyReceiptIds(sheet)
    ) {
      ui.alert(
        "No Tracked Emails In This Sheet",
        "No tracked receipt IDs were found for this sheet.\n\nYou cannot add receipt tracking after emails are already sent, but you can enable tracking now for future sends in Settings.",
        ui.ButtonSet.OK,
      );
      return;
    }

    const lines = [
      `Checked ${result.checked} receipt(s).`,
      `Opened: ${result.received}`,
      `Still pending: ${result.pending}`,
    ];
    ui.alert("KISS Mail Merge – Receipts", lines.join("\n"), ui.ButtonSet.OK);
  } catch (e) {
    const msg = String(e);
    if (msg.includes("No mail merge setup found")) {
      ui.alert(
        "No Mail Merge Setup Yet",
        "This sheet does not have a KISS Mail Merge setup yet.\n\nOpen Configure Mail Merge first, then send tracked emails before using Check Receipts.",
        ui.ButtonSet.OK,
      );
    } else if (msg.includes("Receipt tracking is not enabled")) {
      ui.alert(
        "Receipt Tracking Not Enabled",
        "Receipt tracking is not currently enabled for this sheet.\n\nTo use this feature, open the KISS Mail Merge sidebar, go to Settings, and enable 'Track email opens'.",
        ui.ButtonSet.OK,
      );
    } else {
      ui.alert("Check Receipts Failed", msg, ui.ButtonSet.OK);
    }
  }
}

export function onInstall(e: GoogleAppsScript.Events.AppsScriptEvent) {
  onOpen(e as GoogleAppsScript.Events.SheetsOnOpen);
}
