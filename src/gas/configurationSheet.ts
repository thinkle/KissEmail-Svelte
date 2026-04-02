import { getSheetById, shortStringify } from "./utils";

type ConfigTable = Record<string, unknown>;

const COLORS = {
  key: {
    even: { fg: "#ffffff", bg: "#283593" },
    odd: { fg: "#E8EAF6", bg: "#303F9F" },
  },
  val: {
    even: { fg: "#1A237E", bg: "#FFECB3" },
    odd: { fg: "#1A237E", bg: "#FFF8E1" },
  },
  lkey: {
    even: { fg: "#E0E0E0", bg: "#424242" },
    odd: { fg: "#F5F5F5", bg: "#212121" },
  },
  lval: {
    even: { fg: "#424242", bg: "#F5F5F5" },
    odd: { fg: "#212121", bg: "#E0E0E0" },
  },
} as const;

function formatKeys(sheet: GoogleAppsScript.Spreadsheet.Sheet, rowNumber: number) {
  const keyColors = rowNumber % 2 ? COLORS.key.even : COLORS.key.odd;
  const valueColors = rowNumber % 2 ? COLORS.val.even : COLORS.val.odd;
  const keyCell = sheet.getRange(rowNumber, 1, 1, 1);
  keyCell.setFontColor(keyColors.fg);
  keyCell.setBackground(keyColors.bg);
  keyCell.setFontWeight("bold");
  keyCell.setFontStyle("normal");
  const valueCell = sheet.getRange(rowNumber, 2, 1, 1);
  valueCell.setFontColor(valueColors.fg);
  valueCell.setBackground(valueColors.bg);
  valueCell.setFontWeight("normal");
  valueCell.setFontStyle("italic");
}

function formatListKeys(sheet: GoogleAppsScript.Spreadsheet.Sheet, columnNumber: number) {
  const keyColors = columnNumber % 2 ? COLORS.lkey.even : COLORS.lkey.odd;
  const valueColors = columnNumber % 2 ? COLORS.lval.even : COLORS.lval.odd;
  const keyCell = sheet.getRange(1, columnNumber, 1, 1);
  keyCell.setFontColor(keyColors.fg);
  keyCell.setBackground(keyColors.bg);
  keyCell.setFontWeight("bold");
  keyCell.setFontStyle("normal");

  const rows = sheet.getLastRow();
  if (rows > 1) {
    const valueRange = sheet.getRange(2, columnNumber, rows - 1, 1);
    valueRange.setFontColor(valueColors.fg);
    valueRange.setBackground(valueColors.bg);
    valueRange.setFontWeight("normal");
    valueRange.setFontStyle("italic");
  }
}

function LookupArray(keys: unknown[], values: unknown[]) {
  const lookup: Record<string, unknown> = {};
  keys.forEach((key) => {
    if (!key) {
      return;
    }
    const stringKey = String(key);
    Object.defineProperty(lookup, stringKey, {
      enumerable: true,
      get() {
        const idx = keys.indexOf(key);
        return idx > -1 ? values[idx] : undefined;
      },
      set(nextValue) {
        const idx = keys.indexOf(key);
        if (idx > -1) {
          values[idx] = nextValue;
        } else {
          keys.push(key);
          values.push(nextValue);
        }
      },
    });
  });
  Object.preventExtensions(lookup);
  return lookup;
}

export type ConfigurationSheetHandle = {
  table: ConfigTable;
  getSheetLink: () => string;
  getSheetId: () => number;
  loadConfigurationTable: () => void;
  writeConfigurationTable: (table?: ConfigTable) => void;
};

export function ConfigurationSheet(
  sheet: GoogleAppsScript.Spreadsheet.Sheet
): ConfigurationSheetHandle {
  function overwriteConfiguration(
    keyValues: Record<string, unknown>,
    listValues: Record<string, unknown[]>
  ) {
    sheet.clear();
    for (const [key, value] of Object.entries(keyValues)) {
      sheet.appendRow([key, value]);
      formatKeys(sheet, sheet.getLastRow());
    }

    let column = 3;
    for (const [key, values] of Object.entries(listValues)) {
      sheet.getRange(1, column, 1, 1).setValue(key);
      values.forEach((value, index) => {
        sheet.getRange(index + 2, column, 1, 1).setValue(value);
      });
      formatListKeys(sheet, column);
      column += 1;
    }
    if (sheet.getLastRow() > 0 && sheet.getLastColumn() > 0) {
      sheet.getDataRange().setWrap(true);
    }
  }

  function overwriteConfigurationTable(table: ConfigTable) {
    const keyValues: Record<string, unknown> = {};
    const listValues: Record<string, unknown[]> = {};

    for (const [key, value] of Object.entries(table)) {
      if (Array.isArray(value)) {
        listValues[key] = value;
      } else {
        keyValues[key] = value;
      }
    }

    overwriteConfiguration(keyValues, listValues);
  }

  function getConfigurationTable(): ConfigTable {
    if (sheet.getLastRow() === 0) {
      return {};
    }

    const keyValues = sheet.getRange(1, 1, sheet.getLastRow(), 2).getValues();
    const data: ConfigTable = {};
    keyValues.forEach(([key, value]) => {
      if (key) {
        data[String(key)] = value;
      }
    });

    const listColumnCount = Math.max(sheet.getLastColumn() - 2, 0);
    if (listColumnCount > 0) {
      const listValues = sheet.getRange(1, 3, sheet.getLastRow(), listColumnCount).getValues();
      const valueListHeaders: string[] = [];
      for (let columnIndex = 0; columnIndex < listColumnCount; columnIndex += 1) {
        const header = String(listValues[0]?.[columnIndex] ?? "");
        valueListHeaders.push(header);
        if (!header) {
          continue;
        }
        const valueList: unknown[] = [];
        for (let rowIndex = 1; rowIndex < sheet.getLastRow(); rowIndex += 1) {
          valueList.push(listValues[rowIndex]?.[columnIndex]);
        }
        data[header] = valueList;
      }

      valueListHeaders.forEach((listHeader) => {
        if (listHeader.endsWith("Key")) {
          const rootName = listHeader.slice(0, -3);
          const values = data[`${rootName}Val`];
          if (Array.isArray(values)) {
            Object.defineProperty(data, `${rootName}Lookup`, {
              value: LookupArray(data[listHeader] as unknown[], values),
              enumerable: false,
            });
          }
        }
      });
    }

    return data;
  }

  return {
    table: {},
    getSheetLink() {
      return `${sheet.getParent().getUrl()}#gid=${sheet.getSheetId()}`;
    },
    getSheetId() {
      return sheet.getSheetId();
    },
    loadConfigurationTable() {
      this.table = getConfigurationTable();
    },
    writeConfigurationTable(table?: ConfigTable) {
      if (table) {
        this.table = table;
      }
      overwriteConfigurationTable(this.table);
    },
  };
}

export function getConfigurationSheetById(
  spreadsheetOrId: GoogleAppsScript.Spreadsheet.Spreadsheet | string,
  sheetId: number | string
) {
  const spreadsheet =
    typeof spreadsheetOrId === "string"
      ? SpreadsheetApp.openById(spreadsheetOrId)
      : spreadsheetOrId;
  const sheet = getSheetById(spreadsheet, sheetId);
  if (!sheet) {
    throw new Error(`Did not find configuration sheet ${shortStringify(sheetId)}`);
  }
  return ConfigurationSheet(sheet);
}
