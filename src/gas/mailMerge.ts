import type { MailMergeConfig, MailMergeResult, CheckReceiptsResult } from "../shared/mailMerge";
import { embedTrackingPixel, sendEmailFromTemplate } from "./emailer";
import { TRACKING_URL } from "./trackingConfig";
import { Table } from "./tableReader";

export const MAIL_MERGE_STATUS_COLUMN = "Mail Merge Status";
export const MAIL_MERGE_IF_COLUMN = "Do Mail Merge";
export const MAIL_MERGE_RECEIPT_ID_COLUMN = "Receipt ID";

export const STATUS_SENT = "Sent";
export const STATUS_OPENED_PREFIX = "Opened";

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
  tableRow: Record<string, unknown>,
  emailTemplate: string,
  subjectTemplate: string,
  bodyTemplate: string,
  ccTemplate = "",
  bccTemplate = "",
  trackingPixelUrl?: string
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
    tableRow,
    false,
    ccTemplate,
    bccTemplate
  );

  tableRow[MAIL_MERGE_STATUS_COLUMN] = STATUS_SENT;

  if (receiptId) {
    tableRow[MAIL_MERGE_RECEIPT_ID_COLUMN] = receiptId;
  }
}

export function doMailMerge(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  config: MailMergeConfig
): MailMergeResult {
  const headers = checkForMergeHeader(sheet, config);

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
      emailRow(
        row,
        config.to,
        config.subject,
        config.template,
        config.cc,
        config.bcc,
        trackingPixelUrl
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

    try {
      const response = UrlFetchApp.fetch(`${baseUrl}/status/${receiptId}`, {
        muteHttpExceptions: true,
      });
      const cfStatus = JSON.parse(response.getContentText());
      if (cfStatus && cfStatus.firstAccessed) {
        const opened = `${STATUS_OPENED_PREFIX}: ${cfStatus.firstAccessed}`;
        if (statusCol !== -1) {
          sheet.getRange(rowIndex + 1, statusCol + 1).setValue(opened);
        }
        received += 1;
      } else {
        pending += 1;
      }
    } catch {
      pending += 1;
    }
  }

  return { checked, received, pending };
}
