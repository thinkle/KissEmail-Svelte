import type {
  CheckReceiptsResult,
  GmailDraftSummary,
  GmailDraftTemplate,
  MailMergeConfig,
  SendTestEmailResult,
  SheetConfigState,
  SheetHeaders,
  SheetRawRows,
  SheetSampleRows,
  SheetShell,
  SheetInfo,
  SidebarStatus,
  TestRow,
  SaveMailMergeConfigInput,
  MailMergeResult,
} from "../shared/mailMerge";
import { getCapabilities } from "./capabilities";
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
import { cleanupObject, withTiming } from "./utils";

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
    contentSource: "template",
    draftId: "",
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
    contentSource: rawConfig.contentSource === "draft" ? "draft" : "template",
    draftId: typeof rawConfig.draftId === "string" ? rawConfig.draftId : defaults.draftId,
  };
}

function getColumnHeaders(): string[] {
  const sheet = getDataSheet();
  return getColumnHeadersForSheet(sheet);
}

function getColumnHeadersForSheet(
  sheet: GoogleAppsScript.Spreadsheet.Sheet
): string[] {
  const dataRange = sheet.getDataRange();
  return sheet
    .getRange(dataRange.getRow(), dataRange.getColumn(), 1, dataRange.getNumColumns())
    .getValues()[0]
    .map((header) => String(header ?? ""));
}

function getSampleRows(headerRows: number): unknown[][] {
  const sheet = getDataSheet();
  return getSampleRowsForSheet(sheet, headerRows);
}

function getSampleRowsForSheet(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  headerRows: number
): unknown[][] {
  const dataRange = sheet.getDataRange();
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
  return withTiming("kissMailMerge.getSheetInfo", {}, () => {
    const shell = getSheetShell();
    const info: SheetInfo = {
      ...shell,
      ...getSheetSampleRows(),
      ...getSidebarStatus(),
    };
    return cleanupObject(info) as SheetInfo;
  });
}

export function getSheetConfig(): SheetConfigState {
  return withTiming("kissMailMerge.getSheetConfig", {}, () => {
    const sheet = getDataSheet();
    const configSheet = setupMergeConfig(sheet);
    return {
      config: toMailMergeConfig(sheet.getName(), configSheet.table),
      sheet: sheet.getName(),
    };
  });
}

export function getSheetHeaders(): SheetHeaders {
  return withTiming("kissMailMerge.getSheetHeaders", {}, () => {
    const sheet = getDataSheet();
    return {
      headers: getColumnHeadersForSheet(sheet),
    };
  });
}

export function getSheetShell(): SheetShell {
  return withTiming("kissMailMerge.getSheetShell", {}, () => ({
    ...getSheetConfig(),
    ...getSheetHeaders(),
  }));
}

export function getSheetSampleRows(): SheetSampleRows {
  return withTiming("kissMailMerge.getSheetSampleRows", {}, () => {
    const sheet = getDataSheet();
    const config = getMergeSettings().table as MailMergeConfig;
    return {
      sampleRows: cleanupObject(
        getSampleRowsForSheet(sheet, Math.max(Number(config.headerRows) || 1, 1))
      ) as SheetSampleRows["sampleRows"],
    };
  });
}

export function getRawRows(limit = 60): SheetRawRows {
  return withTiming("kissMailMerge.getRawRows", { limit }, () => {
    const sheet = getDataSheet();
    const dataRange = sheet.getDataRange();
    const rowOffset = dataRange.getRow();
    const totalRows = dataRange.getNumRows();
    const columnOffset = dataRange.getColumn();
    const totalColumns = dataRange.getNumColumns();

    if (totalRows <= 1 || totalColumns <= 0) {
      return { rowNumbers: [], rows: [] };
    }

    const rowCount = Math.min(totalRows - 1, limit);
    const values = sheet
      .getRange(rowOffset + 1, columnOffset, rowCount, totalColumns)
      .getValues();

    return cleanupObject({
      rowNumbers: Array.from({ length: rowCount }, (_, index) => rowOffset + 1 + index),
      rows: values,
    }) as SheetRawRows;
  });
}

export function getSidebarStatus(): SidebarStatus {
  return withTiming("kissMailMerge.getSidebarStatus", {}, () => {
    const sheet = getDataSheet();
    return {
      quota: MailApp.getRemainingDailyQuota(),
      autoReceiptStatus: getAutoReceiptStatus(sheet),
      receiptSummary: summarizeReceiptTracking(sheet),
      capabilities: getCapabilities(),
    };
  });
}

export function saveConfig(settings: Partial<SaveMailMergeConfigInput>): MailMergeConfig {
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

export function listRecentDrafts(limit = 20): GmailDraftSummary[] {
  return withTiming("kissMailMerge.listRecentDrafts", { limit }, () => {
    const drafts = GmailApp.getDrafts().slice(0, limit);
    return cleanupObject(
      drafts.map((draft) => {
        const message = draft.getMessage();
        return {
          id: draft.getId(),
          subject: message.getSubject() || "(No subject)",
          to: message.getTo() || "",
          updatedAt: message.getDate().toISOString(),
        };
      }),
    ) as GmailDraftSummary[];
  });
}

function getDraftWarnings(htmlBody: string): string[] {
  const warnings: string[] = [];
  if (/src\s*=\s*["']cid:/i.test(htmlBody)) {
    warnings.push("This draft contains embedded images and may not round-trip cleanly.");
  }
  if (/src\s*=\s*["']data:image\//i.test(htmlBody)) {
    warnings.push("This draft includes data-URI images, which can be large and fragile in sheet-stored HTML.");
  }
  return warnings;
}

export function getDraftTemplate(draftId: string): GmailDraftTemplate {
  return withTiming("kissMailMerge.getDraftTemplate", { draftId }, () => {
    const draft = GmailApp.getDraft(draftId);
    if (!draft) {
      throw new Error("Draft not found.");
    }
    const message = draft.getMessage();
    const htmlBody = message.getBody() || "";
    return {
      id: draft.getId(),
      subject: message.getSubject() || "",
      htmlBody,
      warnings: getDraftWarnings(htmlBody),
    };
  });
}

function getBodyTemplate(config: MailMergeConfig): string {
  if (config.contentSource === "draft") {
    const draftId = String(config.draftId || "").trim();
    if (!draftId) {
      throw new Error("No Gmail draft selected.");
    }
    return getDraftTemplate(draftId).htmlBody;
  }
  return config.template;
}

export function enableAutoReceiptChecks(sheetName?: string): MailMergeConfig {
  const startedAt = Date.now();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = sheetName
    ? spreadsheet.getSheetByName(sheetName)
    : getDataSheet();

  console.log(
    JSON.stringify({
      event: "enableAutoReceiptChecks.begin",
      requestedSheetName: sheetName ?? null,
      activeSpreadsheetId: spreadsheet?.getId?.() ?? null,
      activeSpreadsheetName: spreadsheet?.getName?.() ?? null,
      resolvedSheetName: sheet?.getName?.() ?? null,
      resolvedSheetId: sheet?.getSheetId?.() ?? null,
    }),
  );

  if (!sheet) {
    throw new Error(`Unable to find sheet ${sheetName}`);
  }

  const configSheet = setupMergeConfig(sheet);
  console.log(
    JSON.stringify({
      event: "enableAutoReceiptChecks.configLoaded",
      dataSheetName: sheet.getName(),
      dataSheetId: sheet.getSheetId(),
      configSheetId: configSheet.getSheetId(),
      configBefore: configSheet.table,
    }),
  );
  const nextConfig = toMailMergeConfig(sheet.getName(), {
    ...configSheet.table,
    trackReceipt: true,
    autoCheckReceipts: true,
  });

  configSheet.table = {
    ...configSheet.table,
    trackReceipt: nextConfig.trackReceipt,
    autoCheckReceipts: nextConfig.autoCheckReceipts,
  };
  configSheet.writeConfigurationTable();

  console.log(
    JSON.stringify({
      event: "enableAutoReceiptChecks.afterWrite",
      sheetName: sheet.getName(),
      sheetId: sheet.getSheetId(),
      nextConfig,
      durationMs: Date.now() - startedAt,
    }),
  );

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
  return withTiming("kissMailMerge.getTestRows", { limit }, () => {
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
  });
}

export function sendTestEmail(rowNumber: number, testAddress: string): SendTestEmailResult {
  if (!testAddress) {
    throw new Error("Please provide a test email address.");
  }

  const config = getMergeSettings().table as MailMergeConfig;
  const bodyTemplate = getBodyTemplate(config);
  if (!bodyTemplate || !config.subject) {
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

  sendEmailFromTemplate(testAddress, config.subject, bodyTemplate, rowObject, false);
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
  const bodyTemplate = getBodyTemplate(config);
  if (!bodyTemplate || !config.to || !config.subject) {
    throw new Error("Missing template, recipient, or subject. Open the sidebar and save configuration first.");
  }

  const result = doMailMerge(sheet, {
    ...config,
    template: bodyTemplate,
  });
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
