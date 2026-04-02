import type { CheckReceiptsResult, MailMergeConfig, SheetInfo } from "../../shared/mailMerge";
import {
  mockConfig,
  mockMergeResult,
  mockSendTestResult,
  mockSheetInfo,
  mockTestRows,
} from "../lib/mockMailMerge";

function openMockDialog() {
  if (typeof window === "undefined") {
    return;
  }
  window.parent?.postMessage({ type: "kiss-mail-merge:open-dialog" }, "*");
}

export function getActiveUserEmail(): string {
  return "thinkle@example.com";
}

export function loadSheetInfo(): SheetInfo {
  return mockSheetInfo();
}

export function saveMailMergeConfig(settings: {
  jobName: string;
  headerRows: number;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  useMergeIf: boolean;
  mergeFormula: string;
  trackReceipt: boolean;
}): MailMergeConfig {
  return {
    ...mockConfig,
    ...settings,
  };
}

export function saveMailMergeTemplate(template: string): SheetInfo {
  return {
    ...mockSheetInfo(),
    config: {
      ...mockConfig,
      template,
    },
  };
}

export function loadTestRows() {
  return mockTestRows();
}

export function sendMailMergeTestEmail(rowNumber: number, testAddress: string) {
  return mockSendTestResult(rowNumber, testAddress);
}

export function runMailMerge(_sheetName: string) {
  return mockMergeResult();
}

export function openEditorDialog(): void {
  openMockDialog();
}


export function checkEmailReceipts(_sheetName?: string): CheckReceiptsResult {
  return { checked: 3, received: 1, pending: 2 };
}

export function debugReceiptTracking(receiptId: string): import("/Users/thinkle/BackedUpProjects/gas/KissEmail-Svelte/src/gas/mailMerge").ReceiptDebugResult {
  return {
    receiptId,
    url: `https://kiss-email-receipts.tmhinkle.workers.dev/status/${receiptId}`,
    statusCode: 200,
    body: JSON.stringify({
      firstAccessed: "2026-04-02T18:15:03.438Z",
      lastAccessed: "2026-04-02T18:15:03.438Z",
      accessCount: 1,
    }),
    parsed: {
      firstAccessed: "2026-04-02T18:15:03.438Z",
      lastAccessed: "2026-04-02T18:15:03.438Z",
      accessCount: 1,
    },
  };
}
