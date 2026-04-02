import type {
  CheckReceiptsResult,
  MailMergeConfig,
  SendTestEmailResult,
  SheetInfo,
  TestRow,
  SaveMailMergeConfigInput,
  MailMergeResult,
} from "../shared/mailMerge";
import { ConfigurationSheet } from "./configurationSheet";
import { applyTemplate, sendEmailFromTemplate } from "./emailer";
import {
  checkEmailReceipts,
  debugReceiptStatus,
  doMailMerge,
  summarizeReceiptTracking,
} from "./mailMerge";
import { getAutoReceiptStatus, syncAutoReceiptMonitoring } from "./receiptScheduler";
import { Table } from "./tableReader";
import { TRACKING_URL } from "./trackingConfig";
import { cleanupObject } from "./utils";

const CONFIG_SHEET_SUFFIX = " Mail Merge Config";

/**
 * Returns the active sheet, but if the user has a config sheet open,
 * redirects to the source data sheet so we don't treat config rows as data.
 */
function getDataSheet(): GoogleAppsScript.Spreadsheet.Sheet {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const active = spreadsheet.getActiveSheet();
  if (active.getName().endsWith(CONFIG_SHEET_SUFFIX)) {
    const sourceName = active.getName().slice(0, -CONFIG_SHEET_SUFFIX.length);
    const sourceSheet = spreadsheet.getSheetByName(sourceName);
    if (sourceSheet) return sourceSheet;
  }
  return active;
}

function getDefaultConfig(sheetName: string): MailMergeConfig {
  return {
    jobName: `${sheetName} Mail Merge`,
    headerRows: 1,
    to: "",
    cc: "",
    bcc: "",
    subject: "",
    template: "",
    useMergeIf: false,
    mergeFormula: "",
    trackReceipt: true,
    autoCheckReceipts: false,
  };
}

function toMailMergeConfig(sheetName: string, rawConfig: Record<string, unknown>): MailMergeConfig {
  const defaults = getDefaultConfig(sheetName);
  return {
    jobName:
      typeof rawConfig.jobName === "string" && rawConfig.jobName
        ? rawConfig.jobName
        : defaults.jobName,
    headerRows: Math.max(Number(rawConfig.headerRows) || defaults.headerRows, 1),
    to: typeof rawConfig.to === "string" ? rawConfig.to : defaults.to,
    cc: typeof rawConfig.cc === "string" ? rawConfig.cc : defaults.cc,
    bcc: typeof rawConfig.bcc === "string" ? rawConfig.bcc : defaults.bcc,
    subject: typeof rawConfig.subject === "string" ? rawConfig.subject : defaults.subject,
    template: typeof rawConfig.template === "string" ? rawConfig.template : defaults.template,
    useMergeIf: Boolean(rawConfig.useMergeIf),
    mergeFormula:
      typeof rawConfig.mergeFormula === "string" ? rawConfig.mergeFormula : defaults.mergeFormula,
    trackReceipt: Boolean(rawConfig.trackReceipt),
    autoCheckReceipts: Boolean(rawConfig.trackReceipt && rawConfig.autoCheckReceipts),
  };
}

function getColumnHeaders(): string[] {
  const sheet = getDataSheet();
  const dataRange = sheet.getDataRange();
  return sheet
    .getRange(dataRange.getRow(), dataRange.getColumn(), 1, dataRange.getNumColumns())
    .getValues()[0]
    .map((header) => String(header ?? ""));
}

function getSampleRows(headerRows: number): unknown[][] {
  const dataRange = getDataSheet().getDataRange();
  const startRow = dataRange.getRow() + headerRows;
  const availableRows = dataRange.getLastRow() - startRow + 1;
  if (availableRows <= 0) {
    return [];
  }
  const rowCount = Math.min(availableRows, 3);
  return dataRange
    .getSheet()
    .getRange(startRow, dataRange.getColumn(), rowCount, dataRange.getNumColumns())
    .getValues();
}

function getConfigSheetName(sheet: GoogleAppsScript.Spreadsheet.Sheet): string {
  return `${sheet.getName()}${CONFIG_SHEET_SUFFIX}`;
}

export function setupMergeConfig(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  template?: string
) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let configSheet = spreadsheet.getSheetByName(getConfigSheetName(sheet));

  if (!configSheet) {
    configSheet = spreadsheet.insertSheet(getConfigSheetName(sheet));
    configSheet.hideSheet();
  }

  const configurationSheet = ConfigurationSheet(configSheet);
  configurationSheet.loadConfigurationTable();
  configurationSheet.table = {
    ...getDefaultConfig(sheet.getName()),
    ...configurationSheet.table,
  };

  if (template !== undefined) {
    configurationSheet.table.template = template;
    configurationSheet.writeConfigurationTable();
  }

  return configurationSheet;
}

export function getMergeSettings() {
  const sheet = getDataSheet();
  const configurationSheet = setupMergeConfig(sheet);
  configurationSheet.table = toMailMergeConfig(sheet.getName(), configurationSheet.table);
  return configurationSheet;
}

export function getSheetInfo(): SheetInfo {
  const sheet = getDataSheet();
  const configSheet = getMergeSettings();
  const config = toMailMergeConfig(sheet.getName(), configSheet.table);
  const info: SheetInfo = {
    headers: getColumnHeaders(),
    config,
    sampleRows: cleanupObject(getSampleRows(config.headerRows)) as SheetInfo["sampleRows"],
    quota: MailApp.getRemainingDailyQuota(),
    sheet: sheet.getName(),
    autoReceiptStatus: getAutoReceiptStatus(sheet, config),
    receiptSummary: summarizeReceiptTracking(sheet),
  };
  return cleanupObject(info) as SheetInfo;
}

export function saveConfig(settings: SaveMailMergeConfigInput): MailMergeConfig {
  const configSheet = getMergeSettings();
  const sheet = getDataSheet();
  configSheet.table = {
    ...configSheet.table,
    ...settings,
  };
  configSheet.writeConfigurationTable();
  const nextConfig = toMailMergeConfig(sheet.getName(), configSheet.table);
  syncAutoReceiptMonitoring(sheet, nextConfig);
  return nextConfig;
}

export function saveTemplate(template: string): SheetInfo {
  const sheet = getDataSheet();
  const configSheet = setupMergeConfig(sheet, template);
  configSheet.table = {
    ...configSheet.table,
    template,
  };
  configSheet.writeConfigurationTable();
  return getSheetInfo();
}

export function getTestRows(limit = 50): TestRow[] {
  const sheet = getDataSheet();
  const config = getMergeSettings().table as MailMergeConfig;
  const headerRows = Math.max(Number(config.headerRows) || 1, 1);
  const dataRange = sheet.getDataRange();
  const rowOffset = dataRange.getRow();
  const totalRows = dataRange.getNumRows();
  const maxRows = Math.min(totalRows, headerRows + limit);

  if (maxRows <= headerRows || !config.to) {
    return [];
  }

  const range = sheet.getRange(
    rowOffset,
    dataRange.getColumn(),
    maxRows,
    dataRange.getNumColumns()
  );
  const table = Table(range);
  const rows: TestRow[] = [];

  for (let index = headerRows; index < table.length; index += 1) {
    const rowNumber = rowOffset + index;
    let toPreview = "";
    try {
      toPreview = applyTemplate(config.to, table[index]);
    } catch {
      toPreview = "";
    }
    rows.push({ row: rowNumber, to: toPreview });
  }

  return cleanupObject(rows) as TestRow[];
}

export function sendTestEmail(rowNumber: number, testAddress: string): SendTestEmailResult {
  if (!testAddress) {
    throw new Error("Please provide a test email address.");
  }

  const config = getMergeSettings().table as MailMergeConfig;
  if (!config.template || !config.subject) {
    throw new Error("Missing template or subject. Please save your configuration and template first.");
  }

  const sheet = getDataSheet();
  const dataRange = sheet.getDataRange();
  const rowOffset = dataRange.getRow();
  const headerRows = Math.max(Number(config.headerRows) || 1, 1);
  const rowIndex = Number(rowNumber) - rowOffset;

  if (rowIndex < headerRows) {
    throw new Error("Row is within header rows.");
  }
  if (rowIndex >= dataRange.getNumRows()) {
    throw new Error("Row is out of range.");
  }

  const headers = sheet
    .getRange(rowOffset, dataRange.getColumn(), 1, dataRange.getNumColumns())
    .getValues()[0];
  const rowValues = sheet
    .getRange(Number(rowNumber), dataRange.getColumn(), 1, dataRange.getNumColumns())
    .getValues()[0];

  const rowObject: Record<string, unknown> = {};
  headers.forEach((header, index) => {
    if (header && !Object.prototype.hasOwnProperty.call(rowObject, String(header))) {
      rowObject[String(header)] = rowValues[index];
    }
  });

  sendEmailFromTemplate(testAddress, config.subject, config.template, rowObject, false);
  return { row: Number(rowNumber), to: testAddress };
}

export function doMerge(sheetName?: string): MailMergeResult {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = sheetName
    ? spreadsheet.getSheetByName(sheetName)
    : getDataSheet();

  if (!sheet) {
    throw new Error(`Unable to find sheet ${sheetName}`);
  }

  const config = toMailMergeConfig(sheet.getName(), getMergeSettings().table as Record<string, unknown>);
  if (!config.template || !config.to || !config.subject) {
    throw new Error("Missing template, recipient, or subject. Open the sidebar and save configuration first.");
  }

  const result = doMailMerge(sheet, config);
  syncAutoReceiptMonitoring(sheet, config);
  return result;
}

export function checkReceipts(sheetName?: string): CheckReceiptsResult {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = sheetName
    ? spreadsheet.getSheetByName(sheetName)
    : getDataSheet();

  if (!sheet) {
    throw new Error(`Unable to find sheet ${sheetName}`);
  }

  const config = toMailMergeConfig(sheet.getName(), getMergeSettings().table as Record<string, unknown>);
  if (!config.trackReceipt) {
    throw new Error("Receipt tracking is not enabled. Enable it in the sidebar settings.");
  }

  return checkEmailReceipts(sheet, TRACKING_URL);
}

export function debugReceipt(receiptId: string) {
  return debugReceiptStatus(receiptId, TRACKING_URL);
}
