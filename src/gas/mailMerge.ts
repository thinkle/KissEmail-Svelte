import type { MailMergeConfig, MailMergeResult } from "../shared/mailMerge";
import { sendEmailFromTemplate } from "./emailer";
import { Table } from "./tableReader";

export const MAIL_MERGE_COMPLETE_COLUMN = "Mail Merge Completed";
export const MAIL_MERGE_IF_COLUMN = "Do Mail Merge";

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

  if (headers.indexOf(MAIL_MERGE_COMPLETE_COLUMN) === -1) {
    sheet.getRange(1, lastColumn + 1).setValue(MAIL_MERGE_COMPLETE_COLUMN);
    headers.push(MAIL_MERGE_COMPLETE_COLUMN);
  }

  return headers;
}

export function emailRow(
  tableRow: Record<string, unknown>,
  emailTemplate: string,
  subjectTemplate: string,
  bodyTemplate: string,
  ccTemplate = "",
  bccTemplate = ""
) {
  sendEmailFromTemplate(
    emailTemplate,
    subjectTemplate,
    bodyTemplate,
    tableRow,
    false,
    ccTemplate,
    bccTemplate
  );
  tableRow[MAIL_MERGE_COMPLETE_COLUMN] = true;
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

  table.forEach((row, index) => {
    if (index < config.headerRows) {
      return;
    }

    const shouldMerge =
      !config.useMergeIf || Boolean(row[MAIL_MERGE_IF_COLUMN as keyof typeof row]);
    const alreadyComplete = row[MAIL_MERGE_COMPLETE_COLUMN as keyof typeof row] === true;

    if (!shouldMerge || alreadyComplete) {
      return;
    }

    try {
      emailRow(row, config.to, config.subject, config.template, config.cc, config.bcc);
      successful += 1;
    } catch (error) {
      row[MAIL_MERGE_COMPLETE_COLUMN] =
        error instanceof Error ? error.message : String(error);
      errors += 1;
    }
  });

  return { successful, errors };
}
