import type {
  CheckReceiptsResult,
  MailMergeConfig,
  MailMergeResult,
  SendTestEmailResult,
  SheetInfo,
  TestRow,
} from "../shared/mailMerge";
import {
  checkReceipts,
  doMerge,
  getSheetInfo,
  getTestRows,
  saveConfig,
  saveTemplate,
  sendTestEmail,
} from "./kissMailMerge";
import { showDialog } from "./serve";

export function getActiveUserEmail(): string {
  return Session.getActiveUser().getEmail();
}

export function loadSheetInfo(): SheetInfo {
  return getSheetInfo();
}

export function saveMailMergeConfig(
  settings: {
    jobName: string;
    headerRows: number;
    to: string;
    cc: string;
    bcc: string;
    subject: string;
    useMergeIf: boolean;
    mergeFormula: string;
    trackReceipt: boolean;
  }
): MailMergeConfig {
  return saveConfig(settings);
}

export function checkEmailReceipts(sheetName?: string): CheckReceiptsResult {
  return checkReceipts(sheetName);
}

export function saveMailMergeTemplate(template: string): SheetInfo {
  return saveTemplate(template);
}

export function loadTestRows(): TestRow[] {
  return getTestRows();
}

export function sendMailMergeTestEmail(
  rowNumber: number,
  testAddress: string
): SendTestEmailResult {
  return sendTestEmail(rowNumber, testAddress);
}

export function runMailMerge(sheetName?: string): MailMergeResult {
  return doMerge(sheetName);
}

export function openEditorDialog(): void {
  showDialog("KISS Mail Merge", false);
}
