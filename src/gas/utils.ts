export type SheetScalar = string | number | boolean | Date | null | undefined;
export type SheetValue = SheetScalar | SheetScalar[];

export function shortStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(error);
  }
}

export function spreadsheetify(value: unknown): string | number | boolean {
  if (Array.isArray(value)) {
    return value.map((item) => spreadsheetify(item)).join(", ");
  }
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return value;
}

export function cleanupObject(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toGMTString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => cleanupObject(item));
  }
  if (typeof value === "function") {
    return undefined;
  }
  if (value && typeof value === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      const nextValue = cleanupObject(entry);
      if (nextValue !== undefined) {
        cleaned[key] = nextValue;
      }
    }
    return cleaned;
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  return undefined;
}

export function getSheetById(
  spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet,
  id: number | string
): GoogleAppsScript.Spreadsheet.Sheet | undefined {
  const targetId = Number(id);
  return spreadsheet.getSheets().find((sheet) => sheet.getSheetId() === targetId);
}

export function getCurrentRange(): GoogleAppsScript.Spreadsheet.Range {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const activeRange = sheet.getActiveRange();
  if (!activeRange) {
    return sheet.getDataRange();
  }
  if (activeRange.getNumRows() > 1) {
    return activeRange;
  }
  return sheet.getDataRange();
}
