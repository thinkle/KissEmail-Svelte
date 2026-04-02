import type { AutoReceiptStatus, MailMergeConfig } from "../shared/mailMerge";
import { checkEmailReceipts } from "./mailMerge";
import { TRACKING_URL } from "./trackingConfig";
import { getSheetById } from "./utils";

type AutoReceiptSheetState = {
  sheetId: number;
  sheetName: string;
  lastCheckedAt?: string;
  lastCheckedPending?: number;
  lastError?: string;
  updatedAt: string;
};

type AutoReceiptRegistry = {
  spreadsheetId: string;
  nextSheetCursor: number;
  sheets: AutoReceiptSheetState[];
};

const REGISTRY_KEY = "kissMailMerge:autoReceiptRegistry:v1";
const RECEIPT_TRIGGER_HANDLER = "runScheduledReceiptChecks";
const CHECK_TIME_BUDGET_MS = 4 * 60 * 1000;

function defaultRegistry(): AutoReceiptRegistry {
  return {
    spreadsheetId: "",
    nextSheetCursor: 0,
    sheets: [],
  };
}

function normalizeRegistry(registry: AutoReceiptRegistry): AutoReceiptRegistry {
  const sheets = registry.sheets.filter(
    (sheet) => Number.isFinite(sheet.sheetId) && sheet.sheetId > 0,
  );
  const nextSheetCursor =
    sheets.length > 0
      ? Math.max(0, Math.min(registry.nextSheetCursor ?? 0, sheets.length - 1))
      : 0;

  return {
    spreadsheetId: registry.spreadsheetId ?? "",
    nextSheetCursor,
    sheets,
  };
}

function getDocumentProperties() {
  return PropertiesService.getDocumentProperties();
}

function readRegistry(): AutoReceiptRegistry {
  const raw = getDocumentProperties().getProperty(REGISTRY_KEY);
  if (!raw) {
    return defaultRegistry();
  }

  try {
    return normalizeRegistry(JSON.parse(raw) as AutoReceiptRegistry);
  } catch {
    return defaultRegistry();
  }
}

function writeRegistry(registry: AutoReceiptRegistry) {
  getDocumentProperties().setProperty(
    REGISTRY_KEY,
    JSON.stringify(normalizeRegistry(registry)),
  );
}

function getReceiptTriggers() {
  return ScriptApp.getProjectTriggers().filter(
    (trigger) => trigger.getHandlerFunction() === RECEIPT_TRIGGER_HANDLER,
  );
}

function syncReceiptTrigger(registry: AutoReceiptRegistry) {
  const triggers = getReceiptTriggers();
  if (registry.sheets.length > 0) {
    if (!triggers.length) {
      ScriptApp.newTrigger(RECEIPT_TRIGGER_HANDLER).timeBased().everyHours(1).create();
      return;
    }
    triggers.slice(1).forEach((trigger) => ScriptApp.deleteTrigger(trigger));
    return;
  }

  triggers.forEach((trigger) => ScriptApp.deleteTrigger(trigger));
}

function upsertSheetState(
  registry: AutoReceiptRegistry,
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
) {
  const now = new Date().toISOString();
  const nextState: AutoReceiptSheetState = {
    sheetId: sheet.getSheetId(),
    sheetName: sheet.getName(),
    updatedAt: now,
  };

  const existingIndex = registry.sheets.findIndex(
    (entry) => entry.sheetId === nextState.sheetId,
  );

  if (existingIndex === -1) {
    registry.sheets.push(nextState);
    return;
  }

  registry.sheets[existingIndex] = {
    ...registry.sheets[existingIndex],
    ...nextState,
  };
}

function removeSheetState(
  registry: AutoReceiptRegistry,
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
) {
  const existingIndex = registry.sheets.findIndex(
    (entry) => entry.sheetId === sheet.getSheetId(),
  );
  if (existingIndex === -1) {
    return;
  }

  registry.sheets.splice(existingIndex, 1);
  if (registry.sheets.length === 0) {
    registry.nextSheetCursor = 0;
  } else if (registry.nextSheetCursor >= registry.sheets.length) {
    registry.nextSheetCursor = 0;
  }
}

function getSpreadsheetForRegistry(
  registry: AutoReceiptRegistry,
): GoogleAppsScript.Spreadsheet.Spreadsheet {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active && (!registry.spreadsheetId || active.getId() === registry.spreadsheetId)) {
    return active;
  }
  if (!registry.spreadsheetId) {
    throw new Error("Receipt registry is missing spreadsheet ID.");
  }
  return SpreadsheetApp.openById(registry.spreadsheetId);
}

export function syncAutoReceiptMonitoring(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  config: MailMergeConfig,
) {
  const registry = readRegistry();
  registry.spreadsheetId = sheet.getParent().getId();

  if (config.trackReceipt && config.autoCheckReceipts) {
    upsertSheetState(registry, sheet);
  } else {
    removeSheetState(registry, sheet);
  }

  writeRegistry(registry);
  syncReceiptTrigger(registry);
}

export function runScheduledReceiptChecks(): void {
  const registry = readRegistry();
  if (!registry.sheets.length) {
    syncReceiptTrigger(registry);
    return;
  }

  const spreadsheet = getSpreadsheetForRegistry(registry);
  const startedAt = Date.now();
  let nextCursor = registry.nextSheetCursor;
  let processedSheets = 0;

  for (let offset = 0; offset < registry.sheets.length; offset += 1) {
    if (processedSheets > 0 && Date.now() - startedAt > CHECK_TIME_BUDGET_MS) {
      break;
    }

    const index = (registry.nextSheetCursor + offset) % registry.sheets.length;
    const entry = registry.sheets[index];
    const now = new Date().toISOString();
    const sheet = getSheetById(spreadsheet, entry.sheetId);

    if (!sheet) {
      registry.sheets[index] = {
        ...entry,
        lastCheckedAt: now,
        lastError: `Missing sheet ${entry.sheetId}`,
        updatedAt: now,
      };
      nextCursor = (index + 1) % registry.sheets.length;
      processedSheets += 1;
      continue;
    }

    try {
      const result = checkEmailReceipts(sheet, TRACKING_URL);
      registry.sheets[index] = {
        ...entry,
        sheetName: sheet.getName(),
        lastCheckedAt: now,
        lastCheckedPending: result.pending,
        lastError: "",
        updatedAt: now,
      };
      console.log(
        JSON.stringify({
          event: "runScheduledReceiptChecks.sheet",
          sheetId: entry.sheetId,
          sheetName: sheet.getName(),
          result,
        }),
      );
    } catch (error) {
      registry.sheets[index] = {
        ...entry,
        sheetName: sheet.getName(),
        lastCheckedAt: now,
        lastError: error instanceof Error ? error.message : String(error),
        updatedAt: now,
      };
      console.log(
        JSON.stringify({
          event: "runScheduledReceiptChecks.error",
          sheetId: entry.sheetId,
          sheetName: sheet.getName(),
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }

    nextCursor = (index + 1) % registry.sheets.length;
    processedSheets += 1;
  }

  if (processedSheets > 0) {
    registry.nextSheetCursor = nextCursor;
  }

  writeRegistry(registry);
  syncReceiptTrigger(registry);
}

export function getAutoReceiptStatus(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  config: MailMergeConfig,
): AutoReceiptStatus {
  const registry = readRegistry();
  const entry = registry.sheets.find((item) => item.sheetId === sheet.getSheetId());

  return {
    enabled: Boolean(config.trackReceipt && config.autoCheckReceipts && entry),
    lastCheckedAt: entry?.lastCheckedAt,
    lastCheckedPending: entry?.lastCheckedPending,
    lastError: entry?.lastError,
  };
}
