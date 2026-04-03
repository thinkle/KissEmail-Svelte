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
import { Table } from "./tableReader";

export const MAIL_MERGE_STATUS_COLUMN = "Mail Merge Status";
export const MAIL_MERGE_IF_COLUMN = "Do Mail Merge";
export const MAIL_MERGE_RECEIPT_ID_COLUMN = "Receipt ID";

export const STATUS_SENT = "Sent";
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

function isSentOrOpened(value: unknown): boolean {
  if (typeof value !== "string" || !value) return false;
  return value === STATUS_SENT || value.startsWith(STATUS_OPENED_PREFIX);
}

function checkForMergeHeader(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  config: MailMergeConfig
): string[] {
  let lastColumn = sheet.getDataRange().getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String);

  if (config.mergeFormula) {
    if (headers.indexOf(MAIL_MERGE_IF_COLUMN) === -1) {
      sheet.getRange(1, lastColumn + 1).setValue(MAIL_MERGE_IF_COLUMN);
      lastColumn += 1;
      headers.push(MAIL_MERGE_IF_COLUMN);
    }
  }

  if (headers.indexOf(MAIL_MERGE_STATUS_COLUMN) === -1) {
    sheet.getRange(1, lastColumn + 1).setValue(MAIL_MERGE_STATUS_COLUMN);
    lastColumn += 1;
    headers.push(MAIL_MERGE_STATUS_COLUMN);
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
  assets?: EmailSendAssets
) {
  let body = bodyTemplate;
  let receiptId: string | undefined;

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
    assets
  );

  writableRow[MAIL_MERGE_STATUS_COLUMN] = STATUS_SENT;

  if (receiptId) {
    writableRow[MAIL_MERGE_RECEIPT_ID_COLUMN] = receiptId;
  }
}

export function doMailMerge(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  config: MailMergeConfig,
  assets?: EmailSendAssets
): MailMergeResult {
  const headers = checkForMergeHeader(sheet, config);
  const displayValues = sheet.getDataRange().getDisplayValues();

  if (config.useMergeIf) {
    const mergeIfColumn = headers.indexOf(MAIL_MERGE_IF_COLUMN) + 1;
    const firstDataRow = 1 + config.headerRows;
    const firstFormulaCell = sheet.getRange(firstDataRow, mergeIfColumn);
    firstFormulaCell.setFormula(config.mergeFormula || "=TRUE");
    const r1c1Formula = firstFormulaCell.getFormulaR1C1();
    const totalRows = sheet.getDataRange().getNumRows();
    const rowsToFill = totalRows - config.headerRows - 1;
    if (rowsToFill > 0) {
      const formulas = Array.from({ length: rowsToFill }, () => [r1c1Formula]);
      sheet.getRange(firstDataRow + 1, mergeIfColumn, rowsToFill).setFormulasR1C1(formulas);
    }
  }

  const table = Table(sheet.getDataRange());
  let successful = 0;
  let errors = 0;

  const trackingPixelUrl = config.trackReceipt ? TRACKING_URL.replace(/\/$/, "") : undefined;

  table.forEach((row, index) => {
    if (index < config.headerRows) {
      return;
    }

    const shouldMerge =
      !config.useMergeIf || Boolean(row[MAIL_MERGE_IF_COLUMN as keyof typeof row]);
    const alreadyComplete = isSentOrOpened(row[MAIL_MERGE_STATUS_COLUMN as keyof typeof row]);

    if (!shouldMerge || alreadyComplete) {
      return;
    }

    try {
      const displayRow = displayValues[index] ?? [];
      const mergeFields = Object.fromEntries(
        headers.map((header, headerIndex) => [header, displayRow[headerIndex] ?? ""]),
      );
      emailRow(
        mergeFields,
        row,
        config.to,
        config.subject,
        config.template,
        config.cc,
        config.bcc,
        trackingPixelUrl,
        assets
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

export function checkEmailReceipts(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  trackingUrl: string
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
    if (typeof currentStatus === "string" && currentStatus.startsWith(STATUS_OPENED_PREFIX)) {
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
    const batch = pendingRows.slice(startIndex, startIndex + RECEIPT_STATUS_BATCH_SIZE);
    const statusMap = fetchReceiptStatusBatch(baseUrl, batch.map(({ receiptId }) => receiptId));

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
  sheet: GoogleAppsScript.Spreadsheet.Sheet
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

  const firstColumnIndex = Math.min(receiptIdCol, statusCol === -1 ? receiptIdCol : statusCol);
  const lastColumnIndex = Math.max(receiptIdCol, statusCol);
  const valueWidth = lastColumnIndex - firstColumnIndex + 1;
  const rowValues = sheet
    .getRange(rowOffset + 1, columnOffset + firstColumnIndex, totalRows - 1, valueWidth)
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
      statusOffset === -1 ? "" : String(rowValues[rowIndex][statusOffset] ?? "");
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
  receiptIds: string[]
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
    })
  );

  if (responseCode < 200 || responseCode >= 300) {
    throw new Error(`Receipt status batch request failed (${responseCode}).`);
  }

  return JSON.parse(body) as ReceiptStatusMap;
}

export function debugReceiptStatus(
  receiptId: string,
  trackingUrl: string
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
