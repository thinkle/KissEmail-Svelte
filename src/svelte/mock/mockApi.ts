import type { CheckReceiptsResult, MailMergeConfig, SheetInfo } from "../../shared/mailMerge";
import type { ReceiptDebugResult } from "../../gas/mailMerge";
import {
  createMockScenarioState,
  makeMockSendTestResult,
  updateMockStateAfterReceiptCheck,
  updateMockStateForSavedConfig,
} from "./mockScenarios";

const state = createMockScenarioState();

function openMockDialog() {
  if (typeof window === "undefined") {
    return;
  }
  window.parent?.postMessage({ type: "kiss-mail-merge:open-dialog" }, "*");
}

export function getActiveUserEmail(): string {
  return state.activeUserEmail;
}

export function loadSheetInfo(): SheetInfo {
  return structuredClone(state.sheetInfo);
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
  autoCheckReceipts: boolean;
}): MailMergeConfig {
  updateMockStateForSavedConfig(state, settings);
  return structuredClone(state.sheetInfo.config);
}

export function saveMailMergeTemplate(template: string): SheetInfo {
  state.sheetInfo.config = {
    ...state.sheetInfo.config,
    template,
  };
  return structuredClone(state.sheetInfo);
}

export function loadTestRows() {
  return structuredClone(state.testRows);
}

export function sendMailMergeTestEmail(rowNumber: number, testAddress: string) {
  return makeMockSendTestResult(rowNumber, testAddress);
}

export function runMailMerge(_sheetName: string) {
  return structuredClone(state.mergeResult);
}

export function openEditorDialog(): void {
  openMockDialog();
}


export function checkEmailReceipts(_sheetName?: string): CheckReceiptsResult {
  updateMockStateAfterReceiptCheck(state);
  return structuredClone(state.checkReceiptsResult);
}

export function debugReceiptTracking(receiptId: string): ReceiptDebugResult {
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
