import type {
  AppCapabilities,
  CheckReceiptsResult,
  GmailDraftSummary,
  GmailDraftTemplate,
  MailMergeConfig,
  SheetConfigState,
  SheetHeaders,
  SheetRawRows,
  SheetInfo,
  SheetSampleRows,
  SheetShell,
  SidebarStatus,
} from "../../shared/mailMerge";
import type { ReceiptDebugResult } from "../../gas/mailMerge";
import {
  createMockScenarioState,
  makeMockSendTestResult,
  updateMockStateAfterReceiptCheck,
  updateMockStateForSavedConfig,
} from "./mockScenarios";

const state = createMockScenarioState();
const mockCapabilities: AppCapabilities = {
  basicMailMerge: { available: true },
  receiptChecks: { available: true },
  receiptScheduling: { available: true },
  gmailDrafts: { available: true },
};
const mockDrafts: GmailDraftSummary[] = [
  {
    id: "draft-welcome",
    subject: "Welcome {{FirstName}}",
    to: "",
    updatedAt: "2026-04-03T10:30:00.000Z",
  },
  {
    id: "draft-followup",
    subject: "Following up",
    to: "",
    updatedAt: "2026-04-02T15:45:00.000Z",
  },
];

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

export function loadSheetConfig(): SheetConfigState {
  return structuredClone({
    config: state.sheetInfo.config,
    sheet: state.sheetInfo.sheet,
  });
}

export function loadSheetHeaders(): SheetHeaders {
  return structuredClone({
    headers: state.sheetInfo.headers,
  });
}

export function loadSheetShell(): SheetShell {
  return structuredClone({
    headers: state.sheetInfo.headers,
    config: state.sheetInfo.config,
    sheet: state.sheetInfo.sheet,
  });
}

export function loadSheetSampleRows(): SheetSampleRows {
  return structuredClone({
    sampleRows: state.sheetInfo.sampleRows,
  });
}

export function loadSidebarStatus(): SidebarStatus {
  return structuredClone({
    quota: state.sheetInfo.quota,
    autoReceiptStatus: state.sheetInfo.autoReceiptStatus,
    receiptSummary: state.sheetInfo.receiptSummary,
    capabilities: mockCapabilities,
  });
}

export function loadRecentDrafts(limit = 20): GmailDraftSummary[] {
  return structuredClone(mockDrafts.slice(0, limit));
}

export function loadDraftTemplate(draftId: string): GmailDraftTemplate {
  const body =
    draftId === "draft-followup"
      ? "<p>Hi {{PreferredName}},</p><p>Your advisor {{AdvisorName}} asked us to check in.</p>"
      : "<p>Dear {{FirstName}},</p><p>Welcome to our program.</p><p><img src=\"https://example.com/logo.png\" alt=\"Logo\"></p>";
  return structuredClone({
    id: draftId,
    subject:
      mockDrafts.find((draft) => draft.id === draftId)?.subject ?? "(No subject)",
    htmlBody: body,
    warnings:
      draftId === "draft-followup"
        ? ["This draft references fields that are not present in the current sheet."]
        : [],
  });
}

export function loadRawRows(limit = 60): SheetRawRows {
  const headerRows = Math.max(Number(state.sheetInfo.config.headerRows) || 1, 1);
  const extraHeaderRows = Array.from({ length: Math.max(headerRows - 1, 0) }, () =>
    state.sheetInfo.headers.map(() => ""),
  );
  const rows = [...extraHeaderRows, ...state.sheetInfo.sampleRows].slice(0, limit);
  return structuredClone({
    rowNumbers: rows.map((_, index) => index + 2),
    rows,
  });
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

export function enableHourlyReceiptChecks(_sheetName?: string): MailMergeConfig {
  updateMockStateForSavedConfig(state, {
    trackReceipt: true,
    autoCheckReceipts: true,
  });
  return structuredClone(state.sheetInfo.config);
}
