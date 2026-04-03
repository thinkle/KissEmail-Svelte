import type {
  CheckReceiptsResult,
  MailMergeConfig,
  MailMergeResult,
  SendTestEmailResult,
  SheetConfigState,
  SheetHeaders,
  SheetRawRows,
  SheetSampleRows,
  SheetShell,
  SheetInfo,
  SidebarStatus,
  TestRow,
} from "../shared/mailMerge";
import {
  checkReceipts,
  debugReceipt,
  doMerge,
  enableAutoReceiptChecks,
  getRawRows,
  getSheetConfig,
  getSheetHeaders,
  getSheetSampleRows,
  getSheetShell,
  getSheetInfo,
  getSidebarStatus,
  getTestRows,
  saveConfig,
  saveTemplate,
  sendTestEmail,
} from "./kissMailMerge";
import { showDialog } from "./serve";
import { withTiming } from "./utils";

export function getActiveUserEmail(): string {
  return withTiming("api.getActiveUserEmail", {}, () =>
    Session.getActiveUser().getEmail()
  );
}

export function loadSheetInfo(): SheetInfo {
  return withTiming("api.loadSheetInfo", {}, () => getSheetInfo());
}

export function loadSheetConfig(): SheetConfigState {
  return withTiming("api.loadSheetConfig", {}, () => getSheetConfig());
}

export function loadSheetHeaders(): SheetHeaders {
  return withTiming("api.loadSheetHeaders", {}, () => getSheetHeaders());
}

export function loadSheetShell(): SheetShell {
  return withTiming("api.loadSheetShell", {}, () => getSheetShell());
}

export function loadSheetSampleRows(): SheetSampleRows {
  return withTiming("api.loadSheetSampleRows", {}, () => getSheetSampleRows());
}

export function loadRawRows(limit?: number): SheetRawRows {
  return withTiming("api.loadRawRows", { limit: limit ?? null }, () =>
    getRawRows(limit)
  );
}

export function loadSidebarStatus(): SidebarStatus {
  return withTiming("api.loadSidebarStatus", {}, () => getSidebarStatus());
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
    autoCheckReceipts: boolean;
  }
): MailMergeConfig {
  return withTiming("api.saveMailMergeConfig", {}, () => saveConfig(settings));
}

export function checkEmailReceipts(sheetName?: string): CheckReceiptsResult {
  return withTiming("api.checkEmailReceipts", { sheetName: sheetName ?? null }, () =>
    checkReceipts(sheetName)
  );
}

export function enableHourlyReceiptChecks(sheetName?: string): MailMergeConfig {
  return withTiming("api.enableHourlyReceiptChecks", { sheetName: sheetName ?? null }, () =>
    enableAutoReceiptChecks(sheetName)
  );
}

export function debugReceiptTracking(receiptId: string) {
  return debugReceipt(receiptId);
}

export function saveMailMergeTemplate(template: string): SheetInfo {
  return withTiming("api.saveMailMergeTemplate", {}, () => saveTemplate(template));
}

export function loadTestRows(): TestRow[] {
  return withTiming("api.loadTestRows", {}, () => getTestRows());
}

export function sendMailMergeTestEmail(
  rowNumber: number,
  testAddress: string
): SendTestEmailResult {
  return withTiming("api.sendMailMergeTestEmail", { rowNumber, testAddress }, () =>
    sendTestEmail(rowNumber, testAddress)
  );
}

export function runMailMerge(sheetName?: string): MailMergeResult {
  return withTiming("api.runMailMerge", { sheetName: sheetName ?? null }, () =>
    doMerge(sheetName)
  );
}

export function openEditorDialog(): void {
  showDialog("KISS Mail Merge", false);
}
