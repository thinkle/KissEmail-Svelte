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
import {
  applyTemplate,
  sendEmailFromTemplate,
  type EmailSendAssets,
} from "./emailer";
import {
  buildMailMergePlan,
  checkEmailReceipts,
  debugReceiptStatus,
  doMailMerge,
  summarizeReceiptTracking,
} from "./mailMerge";
import {
  getAutoReceiptStatus,
  syncAutoReceiptMonitoring,
} from "./receiptScheduler";
import { Table } from "./tableReader";
import { TRACKING_URL } from "./trackingConfig";
import { cleanupObject, withTiming } from "./utils";

const CONFIG_SHEET_SUFFIX = " Mail Merge Config";

type MailMergeSendSource = {
  htmlBody: string;
  subject: string;
  assets?: EmailSendAssets;
};

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

function toMailMergeConfig(
  sheetName: string,
  rawConfig: Record<string, unknown>,
): MailMergeConfig {
  const defaults = getDefaultConfig(sheetName);
  return {
    jobName:
      typeof rawConfig.jobName === "string" && rawConfig.jobName
        ? rawConfig.jobName
        : defaults.jobName,
    headerRows: Math.max(
      Number(rawConfig.headerRows) || defaults.headerRows,
      1,
    ),
    to: typeof rawConfig.to === "string" ? rawConfig.to : defaults.to,
    cc: typeof rawConfig.cc === "string" ? rawConfig.cc : defaults.cc,
    bcc: typeof rawConfig.bcc === "string" ? rawConfig.bcc : defaults.bcc,
    subject:
      typeof rawConfig.subject === "string"
        ? rawConfig.subject
        : defaults.subject,
    template:
      typeof rawConfig.template === "string"
        ? rawConfig.template
        : defaults.template,
    useMergeIf: Boolean(rawConfig.useMergeIf),
    mergeFormula:
      typeof rawConfig.mergeFormula === "string"
        ? rawConfig.mergeFormula
        : defaults.mergeFormula,
    trackReceipt: Boolean(rawConfig.trackReceipt),
    autoCheckReceipts: Boolean(
      rawConfig.trackReceipt && rawConfig.autoCheckReceipts,
    ),
    contentSource: rawConfig.contentSource === "draft" ? "draft" : "template",
    draftId:
      typeof rawConfig.draftId === "string"
        ? rawConfig.draftId
        : defaults.draftId,
  };
}

function getColumnHeaders(): string[] {
  const sheet = getDataSheet();
  return getColumnHeadersForSheet(sheet);
}

function getColumnHeadersForSheet(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
): string[] {
  const dataRange = sheet.getDataRange();
  return sheet
    .getRange(
      dataRange.getRow(),
      dataRange.getColumn(),
      1,
      dataRange.getNumColumns(),
    )
    .getValues()[0]
    .map((header) => String(header ?? "").trim())
    .filter(Boolean);
}

function getSampleRows(headerRows: number): unknown[][] {
  const sheet = getDataSheet();
  return getSampleRowsForSheet(sheet, headerRows);
}

function getSampleRowsForSheet(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  headerRows: number,
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
    .getRange(
      startRow,
      dataRange.getColumn(),
      rowCount,
      dataRange.getNumColumns(),
    )
    .getValues();
}

function getConfigSheetName(sheet: GoogleAppsScript.Spreadsheet.Sheet): string {
  return `${sheet.getName()}${CONFIG_SHEET_SUFFIX}`;
}

export function setupMergeConfig(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  template?: string,
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
  configurationSheet.table = toMailMergeConfig(
    sheet.getName(),
    configurationSheet.table,
  );
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
        getSampleRowsForSheet(
          sheet,
          Math.max(Number(config.headerRows) || 1, 1),
        ),
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
      .getDisplayValues();

    return cleanupObject({
      rowNumbers: Array.from(
        { length: rowCount },
        (_, index) => rowOffset + 1 + index,
      ),
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

export function saveConfig(
  settings: Partial<SaveMailMergeConfigInput>,
): MailMergeConfig {
  const configSheet = getMergeSettings();
  const sheet = getDataSheet();
  const previousConfig = toMailMergeConfig(
    sheet.getName(),
    configSheet.table as Record<string, unknown>,
  );
  configSheet.table = {
    ...configSheet.table,
    ...settings,
  };
  configSheet.writeConfigurationTable();
  const nextConfig = toMailMergeConfig(sheet.getName(), configSheet.table);
  if (
    previousConfig.trackReceipt !== nextConfig.trackReceipt ||
    previousConfig.autoCheckReceipts !== nextConfig.autoCheckReceipts
  ) {
    syncAutoReceiptMonitoring(sheet, nextConfig);
  }
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
    warnings.push(
      "This email includes internal images. Send a test email to confirm they appear correctly.",
    );
  }
  if (/src\s*=\s*["']data:image\//i.test(htmlBody)) {
    warnings.push(
      "This draft includes data-URI images. Some email clients handle these unreliably.",
    );
  }
  return warnings;
}

function extractInlineImageIds(rawContent: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const headerPattern = /^(Content-ID|X-Attachment-Id):\s*<?([^>\r\n]+)>?/gim;

  for (const match of rawContent.matchAll(headerPattern)) {
    const id = match[2]?.trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }

  return ids;
}

function getDraftSendSource(draftId: string): MailMergeSendSource {
  return withTiming("kissMailMerge.getDraftSendSource", { draftId }, () => {
    const draft = GmailApp.getDraft(draftId);
    if (!draft) {
      throw new Error("Draft not found.");
    }

    const message = draft.getMessage();
    const htmlBody = message.getBody() || "";

    const attachments = message
      .getAttachments({ includeInlineImages: false, includeAttachments: true })
      .map((attachment) => attachment.copyBlob());
    const inlineBlobs = message
      .getAttachments({ includeInlineImages: true, includeAttachments: false })
      .map((attachment) => attachment.copyBlob());
    const rawContent = message.getRawContent();
    const inlineIds = extractInlineImageIds(rawContent);
    const inlineImages: Record<string, GoogleAppsScript.Base.BlobSource> = {};

    inlineBlobs.forEach((blob, index) => {
      const cid = inlineIds[index];
      if (!cid) {
        return;
      }
      inlineImages[cid] = blob;
    });

    const assets: EmailSendAssets = {};
    if (attachments.length) {
      assets.attachments = attachments;
    }
    if (Object.keys(inlineImages).length) {
      assets.inlineImages = inlineImages;
    }

    return {
      htmlBody,
      subject: message.getSubject() || "",
      assets: Object.keys(assets).length ? assets : undefined,
    };
  });
}

function buildDraftPreviewInlineImages(
  rawContent: string,
  inlineBlobs: GoogleAppsScript.Base.Blob[],
): Record<string, string> {
  const inlineIds = extractInlineImageIds(rawContent);
  const previewInlineImages: Record<string, string> = {};

  inlineBlobs.forEach((blob, index) => {
    const cid = inlineIds[index];
    if (!cid) {
      return;
    }
    const contentType = blob.getContentType() || "application/octet-stream";
    const bytes = blob.getBytes();
    const base64 = Utilities.base64Encode(bytes);
    previewInlineImages[cid] = `data:${contentType};base64,${base64}`;
  });

  return previewInlineImages;
}

export function getDraftTemplate(draftId: string): GmailDraftTemplate {
  return withTiming("kissMailMerge.getDraftTemplate", { draftId }, () => {
    const draft = GmailApp.getDraft(draftId);
    if (!draft) {
      throw new Error("Draft not found.");
    }
    const message = draft.getMessage();
    const htmlBody = message.getBody() || "";
    const rawContent = message.getRawContent();
    const inlineBlobs = message
      .getAttachments({ includeInlineImages: true, includeAttachments: false })
      .map((attachment) => attachment.copyBlob());
    return {
      id: draft.getId(),
      subject: message.getSubject() || "",
      htmlBody,
      warnings: getDraftWarnings(htmlBody),
      previewInlineImages: buildDraftPreviewInlineImages(
        rawContent,
        inlineBlobs,
      ),
    };
  });
}

function getSendSource(config: MailMergeConfig): MailMergeSendSource {
  if (config.contentSource === "draft") {
    const draftId = String(config.draftId || "").trim();
    if (!draftId) {
      throw new Error("No Gmail draft selected.");
    }
    return getDraftSendSource(draftId);
  }
  return {
    htmlBody: config.template,
    subject: config.subject,
  };
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
      dataRange.getNumColumns(),
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

export function sendTestEmail(
  rowNumber: number,
  testAddress: string,
): SendTestEmailResult {
  if (!testAddress) {
    throw new Error("Please provide a test email address.");
  }

  const config = getMergeSettings().table as MailMergeConfig;
  const sendSource = getSendSource(config);
  const bodyTemplate = sendSource.htmlBody;
  if (!bodyTemplate || !sendSource.subject) {
    throw new Error(
      "Missing email content or subject. Save your template or select a Gmail draft first.",
    );
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
    .getDisplayValues()[0];
  const rowValues = sheet
    .getRange(
      Number(rowNumber),
      dataRange.getColumn(),
      1,
      dataRange.getNumColumns(),
    )
    .getDisplayValues()[0];

  const rowObject: Record<string, unknown> = {};
  headers.forEach((header, index) => {
    if (
      header &&
      !Object.prototype.hasOwnProperty.call(rowObject, String(header))
    ) {
      rowObject[String(header)] = rowValues[index];
    }
  });

  sendEmailFromTemplate(
    testAddress,
    sendSource.subject,
    bodyTemplate,
    rowObject,
    false,
    "",
    "",
    sendSource.assets,
  );
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

  const config = toMailMergeConfig(
    sheet.getName(),
    getMergeSettings().table as Record<string, unknown>,
  );
  const sendSource = getSendSource(config);
  const bodyTemplate = sendSource.htmlBody;
  if (!bodyTemplate || !config.to || !sendSource.subject) {
    throw new Error(
      "Missing email content, recipient, or subject. Open the sidebar and save configuration first.",
    );
  }

  const mergeConfig = {
    ...config,
    subject: sendSource.subject,
    template: bodyTemplate,
  };
  const plan = buildMailMergePlan(sheet, mergeConfig);
  const pendingCount = plan.pendingRowIndexes.length;

  if (pendingCount <= 0) {
    spreadsheet.toast("No pending emails to send.", "KISS Mail Merge", 5);
    return { successful: 0, errors: 0, cancelled: false, pendingCount: 0 };
  }

  const ui = SpreadsheetApp.getUi();
  const pendingLabel = `${pendingCount} email${pendingCount === 1 ? "" : "s"}`;
  const detailLines = [`Send ${pendingLabel} now?`];

  if (plan.skippedCompletedCount > 0) {
    detailLines.push(`Skipping ${plan.skippedCompletedCount} already sent.`);
  }
  if (plan.retryingErrorCount > 0) {
    detailLines.push(`Retrying ${plan.retryingErrorCount} previously errored.`);
  }
  if (plan.skippedByConditionCount > 0) {
    detailLines.push(
      `Skipping ${plan.skippedByConditionCount} filtered out by Do Mail Merge.`,
    );
  }

  const choice = ui.alert(
    "KISS Mail Merge",
    detailLines.join("\n"),
    ui.ButtonSet.OK_CANCEL,
  );

  if (choice !== ui.Button.OK) {
    spreadsheet.toast("Mail merge cancelled.", "KISS Mail Merge", 5);
    return { successful: 0, errors: 0, cancelled: true, pendingCount };
  }

  const result = doMailMerge(sheet, mergeConfig, sendSource.assets, plan);

  const sentLabel = `${result.successful} sent`;
  const errorLabel = `${result.errors} error${result.errors === 1 ? "" : "s"}`;
  spreadsheet.toast(
    `Mail merge complete: ${sentLabel}, ${errorLabel}.`,
    "KISS Mail Merge",
    8,
  );

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

  const rawConfigSheet = spreadsheet.getSheetByName(getConfigSheetName(sheet));
  if (!rawConfigSheet) {
    throw new Error(
      "No mail merge setup found for this sheet. Open Configure Mail Merge first.",
    );
  }

  const configSheet = ConfigurationSheet(rawConfigSheet);
  configSheet.loadConfigurationTable();
  const config = toMailMergeConfig(
    sheet.getName(),
    configSheet.table as Record<string, unknown>,
  );
  if (!config.trackReceipt) {
    throw new Error(
      "Receipt tracking is not enabled. Enable it in the sidebar settings.",
    );
  }

  return checkEmailReceipts(sheet, TRACKING_URL);
}

export function debugReceipt(receiptId: string) {
  return debugReceiptStatus(receiptId, TRACKING_URL);
}
