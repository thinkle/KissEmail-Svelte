import type {
  CheckReceiptsResult,
  MailMergeConfig,
  MailMergeResult,
  ReceiptSummary,
} from "../shared/mailMerge";
import {
  embedTrackingPixel,
  sendEmailFromTemplate,
  type EmailSendAssets,
} from "./emailer";
import { TRACKING_URL } from "./trackingConfig";
import { Table, type TableArray } from "./tableReader";

export const MAIL_MERGE_STATUS_COLUMN = "Mail Merge Status";
export const MAIL_MERGE_STATUS_COLUMN_LEGACY = "Mail Merge Completed";
export const MAIL_MERGE_IF_COLUMN = "Do Mail Merge";
export const MAIL_MERGE_RECEIPT_ID_COLUMN = "Receipt ID";

export const STATUS_SENT = "Sent";
export const STATUS_SENT_PREFIX = `${STATUS_SENT}:`;
export const STATUS_OPENED_PREFIX = "Opened";
const RECEIPT_STATUS_BATCH_SIZE = 100;

export type ReceiptDebugResult = {
  receiptId: string;
  url: string;
  statusCode: number;
  body: string;
  parsed: unknown;
};

type ReceiptRecord = {
  firstAccessed: string;
  lastAccessed: string;
  accessCount: number;
};

type ReceiptStatusMap = Record<string, ReceiptRecord | null>;

type MailMergePlan = {
  headers: string[];
  displayValues: string[][];
  table: TableArray;
  pendingRowIndexes: number[];
  freshPendingCount: number;
  retryingErrorCount: number;
  skippedCompletedCount: number;
  skippedByConditionCount: number;
  trackingPixelUrl?: string;
};

function isLegacyCompletedValue(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return false;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;

  return (
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "y" ||
    normalized === "1" ||
    normalized === "sent" ||
    normalized === "done" ||
    normalized === "complete" ||
    normalized === "completed" ||
    normalized.startsWith(STATUS_OPENED_PREFIX.toLowerCase())
  );
}

// Sending is controlled by this status check:
// - truthy legacy values (old "Mail Merge Completed" data) are treated as completed
// - "Sent" and "Opened..." values are treated as completed
// Changing a completed status cell back to a non-completed value makes that row eligible to send again.
function isSentOrOpened(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string" || !value) return false;

  const normalized = value.trim();
  return (
    normalized === STATUS_SENT ||
    normalized.startsWith(STATUS_SENT_PREFIX) ||
    normalized.startsWith(STATUS_OPENED_PREFIX) ||
    isLegacyCompletedValue(normalized)
  );
}

function isErrorStatus(value: unknown): boolean {
  return typeof value === "string" && value.startsWith("Error:");
}

function normalizeLegacyStatusColumn(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  columnIndex: number,
  headerRows: number,
) {
  const lastRow = sheet.getDataRange().getLastRow();
  const firstDataRow = headerRows + 1;
  const rowCount = lastRow - headerRows;

  if (rowCount <= 0) {
    return;
  }

  const range = sheet.getRange(firstDataRow, columnIndex + 1, rowCount, 1);
  const values = range.getValues();
  let changed = false;

  const normalizedValues = values.map(([value]) => {
    if (isSentOrOpened(value)) {
      if (value !== STATUS_SENT) {
        changed = true;
        return [STATUS_SENT];
      }
      return [value];
    }

    return [value];
  });

  if (changed) {
    range.setValues(normalizedValues);
  }
}

function checkForMergeHeader(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  config: MailMergeConfig,
): string[] {
  let lastColumn = sheet.getDataRange().getLastColumn();
  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map(String);

  if (config.mergeFormula) {
    if (headers.indexOf(MAIL_MERGE_IF_COLUMN) === -1) {
      sheet.getRange(1, lastColumn + 1).setValue(MAIL_MERGE_IF_COLUMN);
      lastColumn += 1;
      headers.push(MAIL_MERGE_IF_COLUMN);
    }
  }

  const legacyStatusIndex = headers.indexOf(MAIL_MERGE_STATUS_COLUMN_LEGACY);
  if (headers.indexOf(MAIL_MERGE_STATUS_COLUMN) === -1) {
    if (legacyStatusIndex !== -1) {
      // Migrate old "Mail Merge Completed" header to the new name in place
      sheet
        .getRange(1, legacyStatusIndex + 1)
        .setValue(MAIL_MERGE_STATUS_COLUMN);
      normalizeLegacyStatusColumn(sheet, legacyStatusIndex, config.headerRows);
      headers[legacyStatusIndex] = MAIL_MERGE_STATUS_COLUMN;
    } else {
      sheet.getRange(1, lastColumn + 1).setValue(MAIL_MERGE_STATUS_COLUMN);
      lastColumn += 1;
      headers.push(MAIL_MERGE_STATUS_COLUMN);
    }
  }

  if (config.trackReceipt) {
    if (headers.indexOf(MAIL_MERGE_RECEIPT_ID_COLUMN) === -1) {
      sheet.getRange(1, lastColumn + 1).setValue(MAIL_MERGE_RECEIPT_ID_COLUMN);
      lastColumn += 1;
      headers.push(MAIL_MERGE_RECEIPT_ID_COLUMN);
      sheet.hideColumns(lastColumn);
    }
  }

  return headers;
}

export function emailRow(
  mergeFields: Record<string, unknown>,
  writableRow: Record<string, unknown>,
  emailTemplate: string,
  subjectTemplate: string,
  bodyTemplate: string,
  ccTemplate = "",
  bccTemplate = "",
  trackingPixelUrl?: string,
  assets?: EmailSendAssets,
) {
  let body = bodyTemplate;
  let receiptId: string | undefined;
  const sentAt = new Date().toISOString();

  if (trackingPixelUrl) {
    receiptId = Utilities.getUuid();
    const pixelUrl = `${trackingPixelUrl}/pixel/${receiptId}`;
    body = embedTrackingPixel(bodyTemplate, pixelUrl);
  }

  sendEmailFromTemplate(
    emailTemplate,
    subjectTemplate,
    body,
    mergeFields,
    false,
    ccTemplate,
    bccTemplate,
    assets,
  );

  writableRow[MAIL_MERGE_STATUS_COLUMN] = `${STATUS_SENT_PREFIX} ${sentAt}`;

  if (receiptId) {
    writableRow[MAIL_MERGE_RECEIPT_ID_COLUMN] = receiptId;
  }
}

export function doMailMerge(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  config: MailMergeConfig,
  assets?: EmailSendAssets,
  plan?: MailMergePlan,
): MailMergeResult {
  const activePlan = plan ?? buildMailMergePlan(sheet, config);
  let successful = 0;
  let errors = 0;

  activePlan.pendingRowIndexes.forEach((index) => {
    const row = activePlan.table[index];

    try {
      const displayRow = activePlan.displayValues[index] ?? [];
      const mergeFields = Object.fromEntries(
        activePlan.headers.map((header, headerIndex) => [
          header,
          displayRow[headerIndex] ?? "",
        ]),
      );
      emailRow(
        mergeFields,
        row,
        config.to,
        config.subject,
        config.template,
        config.cc,
        config.bcc,
        activePlan.trackingPixelUrl,
        assets,
      );
      successful += 1;
    } catch (error) {
      row[MAIL_MERGE_STATUS_COLUMN] =
        `Error: ${error instanceof Error ? error.message : String(error)}`;
      errors += 1;
    }
  });

  return { successful, errors };
}

export function buildMailMergePlan(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  config: MailMergeConfig,
): MailMergePlan {
  const headers = checkForMergeHeader(sheet, config);
  prepareMergeIfColumn(sheet, config, headers);
  const dataRange = sheet.getDataRange();
  const displayValues = dataRange.getDisplayValues();
  const table = Table(dataRange);
  const summary = collectPendingMailMergeSummary(table, config);
  const trackingPixelUrl = config.trackReceipt
    ? TRACKING_URL.replace(/\/$/, "")
    : undefined;

  return {
    headers,
    displayValues,
    table,
    pendingRowIndexes: summary.pendingRowIndexes,
    freshPendingCount: summary.freshPendingCount,
    retryingErrorCount: summary.retryingErrorCount,
    skippedCompletedCount: summary.skippedCompletedCount,
    skippedByConditionCount: summary.skippedByConditionCount,
    trackingPixelUrl,
  };
}

function prepareMergeIfColumn(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  config: MailMergeConfig,
  headers: string[],
) {
  if (!config.useMergeIf) {
    return;
  }

  const mergeIfColumn = headers.indexOf(MAIL_MERGE_IF_COLUMN) + 1;
  if (mergeIfColumn <= 0) {
    return;
  }

  const firstDataRow = 1 + config.headerRows;
  const firstFormulaCell = sheet.getRange(firstDataRow, mergeIfColumn);
  firstFormulaCell.setFormula(config.mergeFormula || "=TRUE");
  const r1c1Formula = firstFormulaCell.getFormulaR1C1();
  const totalRows = sheet.getDataRange().getNumRows();
  const rowsToFill = totalRows - config.headerRows - 1;
  if (rowsToFill > 0) {
    const formulas = Array.from({ length: rowsToFill }, () => [r1c1Formula]);
    sheet
      .getRange(firstDataRow + 1, mergeIfColumn, rowsToFill)
      .setFormulasR1C1(formulas);
  }
}

export function countPendingMailMergeRows(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  config: MailMergeConfig,
): number {
  return buildMailMergePlan(sheet, config).pendingRowIndexes.length;
}

function collectPendingMailMergeRowIndexes(
  table: TableArray,
  config: MailMergeConfig,
): number[] {
  return collectPendingMailMergeSummary(table, config).pendingRowIndexes;
}

function collectPendingMailMergeSummary(
  table: TableArray,
  config: MailMergeConfig,
): {
  pendingRowIndexes: number[];
  freshPendingCount: number;
  retryingErrorCount: number;
  skippedCompletedCount: number;
  skippedByConditionCount: number;
} {
  const pendingRowIndexes: number[] = [];
  let freshPendingCount = 0;
  let retryingErrorCount = 0;
  let skippedCompletedCount = 0;
  let skippedByConditionCount = 0;

  table.forEach((row, index) => {
    if (index < config.headerRows) {
      return;
    }

    const shouldMerge =
      !config.useMergeIf ||
      Boolean(row[MAIL_MERGE_IF_COLUMN as keyof typeof row]);
    const alreadyComplete = isSentOrOpened(
      row[MAIL_MERGE_STATUS_COLUMN as keyof typeof row],
    );
    const errored = isErrorStatus(
      row[MAIL_MERGE_STATUS_COLUMN as keyof typeof row],
    );

    if (!shouldMerge) {
      skippedByConditionCount += 1;
      return;
    }

    if (alreadyComplete) {
      skippedCompletedCount += 1;
      return;
    }

    if (shouldMerge && !alreadyComplete) {
      pendingRowIndexes.push(index);
      if (errored) {
        retryingErrorCount += 1;
      } else {
        freshPendingCount += 1;
      }
    }
  });

  return {
    pendingRowIndexes,
    freshPendingCount,
    retryingErrorCount,
    skippedCompletedCount,
    skippedByConditionCount,
  };
}

export function checkEmailReceipts(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  trackingUrl: string,
): CheckReceiptsResult {
  const dataRange = sheet.getDataRange();
  const headers = dataRange.getValues()[0].map(String);
  const receiptIdCol = headers.indexOf(MAIL_MERGE_RECEIPT_ID_COLUMN);
  const statusCol = headers.indexOf(MAIL_MERGE_STATUS_COLUMN);

  if (receiptIdCol === -1) {
    return { checked: 0, received: 0, pending: 0 };
  }

  const baseUrl = trackingUrl.replace(/\/$/, "");
  const allValues = dataRange.getValues();
  const pendingRows: Array<{ rowIndex: number; receiptId: string }> = [];
  let checked = 0;
  let received = 0;
  let pending = 0;

  for (let rowIndex = 1; rowIndex < allValues.length; rowIndex++) {
    const receiptId = String(allValues[rowIndex][receiptIdCol] ?? "").trim();
    if (!receiptId) {
      continue;
    }

    checked += 1;
    const currentStatus = allValues[rowIndex][statusCol];
    if (
      typeof currentStatus === "string" &&
      currentStatus.startsWith(STATUS_OPENED_PREFIX)
    ) {
      received += 1;
      continue;
    }

    pendingRows.push({ rowIndex, receiptId });
  }

  for (
    let startIndex = 0;
    startIndex < pendingRows.length;
    startIndex += RECEIPT_STATUS_BATCH_SIZE
  ) {
    const batch = pendingRows.slice(
      startIndex,
      startIndex + RECEIPT_STATUS_BATCH_SIZE,
    );
    const statusMap = fetchReceiptStatusBatch(
      baseUrl,
      batch.map(({ receiptId }) => receiptId),
    );

    batch.forEach(({ rowIndex, receiptId }) => {
      const cfStatus = statusMap[receiptId];
      if (cfStatus && cfStatus.firstAccessed) {
        const opened = `${STATUS_OPENED_PREFIX}: ${cfStatus.firstAccessed}`;
        if (statusCol !== -1) {
          sheet.getRange(rowIndex + 1, statusCol + 1).setValue(opened);
        }
        received += 1;
      } else {
        pending += 1;
      }
    });
  }

  return { checked, received, pending };
}

export function summarizeReceiptTracking(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
): ReceiptSummary {
  const dataRange = sheet.getDataRange();
  const totalRows = dataRange.getNumRows();
  const totalColumns = dataRange.getNumColumns();
  const rowOffset = dataRange.getRow();
  const columnOffset = dataRange.getColumn();

  if (totalRows <= 0 || totalColumns <= 0) {
    return { tracked: 0, opened: 0, pending: 0 };
  }

  const headers = sheet
    .getRange(rowOffset, columnOffset, 1, totalColumns)
    .getValues()[0]
    .map(String);
  const receiptIdCol = headers.indexOf(MAIL_MERGE_RECEIPT_ID_COLUMN);
  const statusCol = headers.indexOf(MAIL_MERGE_STATUS_COLUMN);

  if (receiptIdCol === -1) {
    return { tracked: 0, opened: 0, pending: 0 };
  }

  if (totalRows === 1) {
    return { tracked: 0, opened: 0, pending: 0 };
  }

  const firstColumnIndex = Math.min(
    receiptIdCol,
    statusCol === -1 ? receiptIdCol : statusCol,
  );
  const lastColumnIndex = Math.max(receiptIdCol, statusCol);
  const valueWidth = lastColumnIndex - firstColumnIndex + 1;
  const rowValues = sheet
    .getRange(
      rowOffset + 1,
      columnOffset + firstColumnIndex,
      totalRows - 1,
      valueWidth,
    )
    .getValues();
  const receiptOffset = receiptIdCol - firstColumnIndex;
  const statusOffset = statusCol === -1 ? -1 : statusCol - firstColumnIndex;

  let tracked = 0;
  let opened = 0;

  for (let rowIndex = 0; rowIndex < rowValues.length; rowIndex += 1) {
    const receiptId = String(rowValues[rowIndex][receiptOffset] ?? "").trim();
    if (!receiptId) {
      continue;
    }

    tracked += 1;
    const status =
      statusOffset === -1
        ? ""
        : String(rowValues[rowIndex][statusOffset] ?? "");
    if (status.startsWith(STATUS_OPENED_PREFIX)) {
      opened += 1;
    }
  }

  return {
    tracked,
    opened,
    pending: Math.max(tracked - opened, 0),
  };
}

function fetchReceiptStatusBatch(
  baseUrl: string,
  receiptIds: string[],
): ReceiptStatusMap {
  const url = `${baseUrl}/status`;
  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ ids: receiptIds }),
    muteHttpExceptions: true,
  });
  const responseCode = response.getResponseCode();
  const body = response.getContentText();

  console.log(
    JSON.stringify({
      event: "checkEmailReceipts.batchFetch",
      receiptIds,
      url,
      responseCode,
      body,
    }),
  );

  if (responseCode < 200 || responseCode >= 300) {
    throw new Error(`Receipt status batch request failed (${responseCode}).`);
  }

  return JSON.parse(body) as ReceiptStatusMap;
}

export function debugReceiptStatus(
  receiptId: string,
  trackingUrl: string,
): ReceiptDebugResult {
  const trimmedReceiptId = String(receiptId ?? "").trim();
  if (!trimmedReceiptId) {
    throw new Error("Missing receipt ID.");
  }

  const url = `${trackingUrl.replace(/\/$/, "")}/status/${trimmedReceiptId}`;
  const response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
  });
  const statusCode = response.getResponseCode();
  const body = response.getContentText();

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = null;
  }

  const result: ReceiptDebugResult = {
    receiptId: trimmedReceiptId,
    url,
    statusCode,
    body,
    parsed,
  };

  console.log(JSON.stringify({ event: "debugReceiptStatus", ...result }));
  return result;
}
