import type {
  AutoReceiptStatus,
  CheckReceiptsResult,
  MailMergeConfig,
  MailMergeResult,
  ReceiptSummary,
  SendTestEmailResult,
  SheetInfo,
  TestRow,
} from "../../shared/mailMerge";

export type MockScenarioId =
  | "draft"
  | "manual"
  | "hourly"
  | "completed"
  | "error";

export type MockScenarioState = {
  activeUserEmail: string;
  sheetInfo: SheetInfo;
  testRows: TestRow[];
  checkReceiptsResult: CheckReceiptsResult;
  mergeResult: MailMergeResult;
};

export type MockScenarioDefinition = {
  id: MockScenarioId;
  label: string;
  description: string;
  createState: () => MockScenarioState;
};

const STORAGE_KEY = "kiss-mail-merge:mock-scenario";
const DEFAULT_SCENARIO: MockScenarioId = "manual";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function baseConfig(overrides: Partial<MailMergeConfig> = {}): MailMergeConfig {
  return {
    jobName: "KISS Mail Merge",
    headerRows: 1,
    to: "{{Email}}",
    cc: "",
    bcc: "",
    subject: "Hello {{FirstName}}",
    template:
      "<p>Hi {{FirstName}},</p>\n<p>This is a mock preview email.</p>\n<p>Thanks!</p>",
    useMergeIf: false,
    mergeFormula: "",
    trackReceipt: true,
    autoCheckReceipts: false,
    ...overrides,
  };
}

function sampleRows(): SheetInfo["sampleRows"] {
  return [
    ["ava.ng@example.com", "Ava", "Ng", 10],
    ["sam.cho@example.com", "Sam", "Cho", 11],
    ["mika.lee@example.com", "Mika", "Lee", 12],
  ];
}

function testRows(): TestRow[] {
  return [
    { row: 2, to: "ava.ng@example.com" },
    { row: 3, to: "sam.cho@example.com" },
    { row: 4, to: "mika.lee@example.com" },
  ];
}

function makeSheetInfo(
  config: MailMergeConfig,
  receiptSummary: ReceiptSummary,
  autoReceiptStatus: AutoReceiptStatus,
): SheetInfo {
  return {
    headers: ["Email", "FirstName", "LastName", "Grade"],
    config,
    sampleRows: sampleRows(),
    quota: 1500,
    sheet: "Contacts",
    autoReceiptStatus,
    receiptSummary,
  };
}

function makeState(options: {
  config?: Partial<MailMergeConfig>;
  receiptSummary: ReceiptSummary;
  autoReceiptStatus?: AutoReceiptStatus;
  checkReceiptsResult?: CheckReceiptsResult;
  mergeResult?: MailMergeResult;
}): MockScenarioState {
  const config = baseConfig(options.config);
  const autoReceiptStatus = options.autoReceiptStatus ?? {
    enabled: Boolean(config.trackReceipt && config.autoCheckReceipts),
  };

  return {
    activeUserEmail: "thinkle@example.com",
    sheetInfo: makeSheetInfo(config, options.receiptSummary, autoReceiptStatus),
    testRows: testRows(),
    checkReceiptsResult:
      options.checkReceiptsResult ??
      ({
        checked: options.receiptSummary.tracked,
        received: options.receiptSummary.opened,
        pending: options.receiptSummary.pending,
      } satisfies CheckReceiptsResult),
    mergeResult: options.mergeResult ?? { successful: 2, errors: 0 },
  };
}

export const MOCK_SCENARIOS: MockScenarioDefinition[] = [
  {
    id: "draft",
    label: "Draft / No Sends Yet",
    description: "Configured sheet, but no tracked messages have been sent yet.",
    createState: () =>
      makeState({
        receiptSummary: { tracked: 0, opened: 0, pending: 0 },
      }),
  },
  {
    id: "manual",
    label: "Manual Receipt Checks",
    description: "Tracked messages exist, but hourly auto-checking is currently off.",
    createState: () =>
      makeState({
        config: { autoCheckReceipts: false },
        receiptSummary: { tracked: 8, opened: 3, pending: 5 },
        autoReceiptStatus: { enabled: false },
      }),
  },
  {
    id: "hourly",
    label: "Hourly Auto-check",
    description: "Receipt tracking is active and the last hourly run completed normally.",
    createState: () =>
      makeState({
        config: { autoCheckReceipts: true },
        receiptSummary: { tracked: 8, opened: 5, pending: 3 },
        autoReceiptStatus: {
          enabled: true,
          lastCheckedAt: "2026-04-02T19:10:00.000Z",
          lastCheckedPending: 3,
        },
      }),
  },
  {
    id: "completed",
    label: "All Opened",
    description: "All tracked messages on this sheet have been opened already.",
    createState: () =>
      makeState({
        config: { autoCheckReceipts: true },
        receiptSummary: { tracked: 6, opened: 6, pending: 0 },
        autoReceiptStatus: {
          enabled: true,
          lastCheckedAt: "2026-04-02T20:05:00.000Z",
          lastCheckedPending: 0,
        },
      }),
  },
  {
    id: "error",
    label: "Hourly Error",
    description: "Hourly auto-checking is enabled, but the most recent run hit an error.",
    createState: () =>
      makeState({
        config: { autoCheckReceipts: true },
        receiptSummary: { tracked: 8, opened: 2, pending: 6 },
        autoReceiptStatus: {
          enabled: true,
          lastCheckedAt: "2026-04-02T20:20:00.000Z",
          lastCheckedPending: 6,
          lastError: "Cloudflare status request failed (524).",
        },
      }),
  },
];

const SCENARIO_MAP = new Map(MOCK_SCENARIOS.map((scenario) => [scenario.id, scenario]));

export function getMockScenarioId(): MockScenarioId {
  if (typeof window === "undefined") {
    return DEFAULT_SCENARIO;
  }

  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get("scenario");
  if (fromUrl && SCENARIO_MAP.has(fromUrl as MockScenarioId)) {
    window.localStorage.setItem(STORAGE_KEY, fromUrl);
    return fromUrl as MockScenarioId;
  }

  const fromStorage = window.localStorage.getItem(STORAGE_KEY);
  if (fromStorage && SCENARIO_MAP.has(fromStorage as MockScenarioId)) {
    return fromStorage as MockScenarioId;
  }

  return DEFAULT_SCENARIO;
}

export function getMockScenarioDefinition(
  scenarioId = getMockScenarioId(),
): MockScenarioDefinition {
  return SCENARIO_MAP.get(scenarioId) ?? SCENARIO_MAP.get(DEFAULT_SCENARIO)!;
}

export function createMockScenarioState(
  scenarioId = getMockScenarioId(),
): MockScenarioState {
  return clone(getMockScenarioDefinition(scenarioId).createState());
}

export function setStoredMockScenario(scenarioId: MockScenarioId) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, scenarioId);
}

export function updateMockStateForSavedConfig(
  state: MockScenarioState,
  updates: Partial<MailMergeConfig>,
) {
  state.sheetInfo.config = {
    ...state.sheetInfo.config,
    ...updates,
  };

  if (!state.sheetInfo.config.trackReceipt) {
    state.sheetInfo.config.autoCheckReceipts = false;
    state.sheetInfo.autoReceiptStatus = { enabled: false };
    state.sheetInfo.receiptSummary = { tracked: 0, opened: 0, pending: 0 };
    state.checkReceiptsResult = { checked: 0, received: 0, pending: 0 };
    return;
  }

  const receiptSummary = state.sheetInfo.receiptSummary ?? {
    tracked: 0,
    opened: 0,
    pending: 0,
  };
  const nextPending = Math.max(receiptSummary.tracked - receiptSummary.opened, 0);
  state.sheetInfo.receiptSummary = {
    ...receiptSummary,
    pending: nextPending,
  };
  state.checkReceiptsResult = {
    checked: state.sheetInfo.receiptSummary.tracked,
    received: state.sheetInfo.receiptSummary.opened,
    pending: nextPending,
  };

  if (state.sheetInfo.config.autoCheckReceipts) {
    state.sheetInfo.autoReceiptStatus = {
      enabled: true,
      lastCheckedAt: state.sheetInfo.autoReceiptStatus?.lastCheckedAt,
      lastCheckedPending: nextPending,
      lastError: state.sheetInfo.autoReceiptStatus?.lastError,
    };
  } else {
    state.sheetInfo.autoReceiptStatus = { enabled: false };
  }
}

export function updateMockStateAfterReceiptCheck(state: MockScenarioState) {
  const receiptSummary = state.sheetInfo.receiptSummary ?? {
    tracked: 0,
    opened: 0,
    pending: 0,
  };

  state.checkReceiptsResult = {
    checked: receiptSummary.tracked,
    received: receiptSummary.opened,
    pending: receiptSummary.pending,
  };

  if (state.sheetInfo.config.autoCheckReceipts) {
    state.sheetInfo.autoReceiptStatus = {
      ...state.sheetInfo.autoReceiptStatus,
      enabled: true,
      lastCheckedAt: new Date().toISOString(),
      lastCheckedPending: receiptSummary.pending,
    };
  }
}

export function makeMockSendTestResult(
  rowNumber: number,
  testAddress: string,
): SendTestEmailResult {
  return {
    row: rowNumber,
    to: testAddress,
  };
}
