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
  const isFollowup = draftId === "draft-followup";
  const body = isFollowup
    ? '<p>Hi {{PreferredName}},</p><p>Your advisor {AdvisorName} asked us to check in.</p><p>Reference: &lt;&lt;CaseManager&gt;&gt;</p><p><img src="cid:followup-inline-image" alt="Inline image"></p>'
    : '<p>Dear {{FirstName}},</p><p>Welcome to our program.</p><p><img src="https://example.com/logo.png" alt="Logo"></p>';
  return structuredClone({
    id: draftId,
    subject:
      mockDrafts.find((draft) => draft.id === draftId)?.subject ??
      "(No subject)",
    htmlBody: body,
    warnings: isFollowup
      ? [
          "This draft contains embedded Gmail images (cid:...). KISS will try to include them when sending.",
        ]
      : [],
    previewInlineImages: isFollowup
      ? {
          "followup-inline-image":
            "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22240%22%20height%3D%22120%22%20viewBox%3D%220%200%20240%20120%22%3E%3Crect%20width%3D%22240%22%20height%3D%22120%22%20fill%3D%22%23efe2ff%22/%3E%3Ccircle%20cx%3D%2260%22%20cy%3D%2260%22%20r%3D%2228%22%20fill%3D%22%23933bd6%22/%3E%3Cpath%20d%3D%22M108%2040h88v12h-88zm0%2020h72v12h-72zm0%2020h96v12h-96z%22%20fill%3D%22%23642aa8%22/%3E%3C/svg%3E",
        }
      : {},
  });
}

export function loadRawRows(limit = 60): SheetRawRows {
  const headerRows = Math.max(
    Number(state.sheetInfo.config.headerRows) || 1,
    1,
  );
  const extraHeaderRows = Array.from(
    { length: Math.max(headerRows - 1, 0) },
    () => state.sheetInfo.headers.map(() => ""),
  );
  const rows = [...extraHeaderRows, ...state.sheetInfo.sampleRows].slice(
    0,
    limit,
  );
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

export function enableHourlyReceiptChecks(
  _sheetName?: string,
): MailMergeConfig {
  updateMockStateForSavedConfig(state, {
    trackReceipt: true,
    autoCheckReceipts: true,
  });
  return structuredClone(state.sheetInfo.config);
}
