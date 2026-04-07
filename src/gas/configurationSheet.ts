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
  const sheetName = sheet.getName();
  const sheetId = sheet.getSheetId();

  function singleColumn<T>(values: T[]): T[][] {
    return values.map((value) => [value]);
  }

  function overwriteConfiguration(
    keyValues: Record<string, unknown>,
    listValues: Record<string, unknown[]>
  ): { rowCount: number; columnCount: number } {
    const keyEntries = Object.entries(keyValues);
    const listEntries = Object.entries(listValues);
    const maxListLength = listEntries.reduce(
      (max, [, values]) => Math.max(max, values.length),
      0
    );
    const rowCount = Math.max(keyEntries.length, listEntries.length ? maxListLength + 1 : 0);
    const columnCount = Math.max(2, listEntries.length + 2);

    sheet.clear();

    if (!rowCount) {
      return { rowCount, columnCount };
    }

    const grid = Array.from({ length: rowCount }, () =>
      Array.from({ length: columnCount }, () => "")
    );

    keyEntries.forEach(([key, value], index) => {
      grid[index][0] = key;
      grid[index][1] = value === undefined || value === null ? "" : value;
    });

    listEntries.forEach(([key, values], index) => {
      const columnIndex = index + 2;
      grid[0][columnIndex] = key;
      values.forEach((value, rowIndex) => {
        grid[rowIndex + 1][columnIndex] = value === undefined || value === null ? "" : value;
      });
    });

    const range = sheet.getRange(1, 1, rowCount, columnCount);
    range.setValues(grid);

    if (keyEntries.length > 0) {
      const keyColorRows = keyEntries.map((_, index) =>
        (index + 1) % 2 ? COLORS.key.even : COLORS.key.odd
      );
      const valueColorRows = keyEntries.map((_, index) =>
        (index + 1) % 2 ? COLORS.val.even : COLORS.val.odd
      );

      sheet
        .getRange(1, 1, keyEntries.length, 1)
        .setFontColors(singleColumn(keyColorRows.map((colors) => colors.fg)))
        .setBackgrounds(singleColumn(keyColorRows.map((colors) => colors.bg)))
        .setFontWeights(singleColumn(keyEntries.map(() => "bold")))
        .setFontStyles(singleColumn(keyEntries.map(() => "normal")));

      sheet
        .getRange(1, 2, keyEntries.length, 1)
        .setFontColors(singleColumn(valueColorRows.map((colors) => colors.fg)))
        .setBackgrounds(singleColumn(valueColorRows.map((colors) => colors.bg)))
        .setFontWeights(singleColumn(keyEntries.map(() => "normal")))
        .setFontStyles(singleColumn(keyEntries.map(() => "italic")));
    }

    if (listEntries.length > 0) {
      const listHeaderColors = listEntries.map((_, index) =>
        (index + 3) % 2 ? COLORS.lkey.even : COLORS.lkey.odd
      );
      const listValueColors = listEntries.map((_, index) =>
        (index + 3) % 2 ? COLORS.lval.even : COLORS.lval.odd
      );

      sheet
        .getRange(1, 3, 1, listEntries.length)
        .setFontColors([listHeaderColors.map((colors) => colors.fg)])
        .setBackgrounds([listHeaderColors.map((colors) => colors.bg)])
        .setFontWeights([listEntries.map(() => "bold")])
        .setFontStyles([listEntries.map(() => "normal")]);

      if (maxListLength > 0) {
        const valueRows = Array.from({ length: maxListLength }, () =>
          listValueColors.map((colors) => colors.fg)
        );
        const backgroundRows = Array.from({ length: maxListLength }, () =>
          listValueColors.map((colors) => colors.bg)
        );
        const weightRows = Array.from({ length: maxListLength }, () =>
          listEntries.map(() => "normal")
        );
        const styleRows = Array.from({ length: maxListLength }, () =>
          listEntries.map(() => "italic")
        );

        sheet
          .getRange(2, 3, maxListLength, listEntries.length)
          .setFontColors(valueRows)
          .setBackgrounds(backgroundRows)
          .setFontWeights(weightRows)
          .setFontStyles(styleRows);
      }
    }

    range.setWrap(true);
    return { rowCount, columnCount };
  }

  function overwriteConfigurationTable(
    table: ConfigTable
  ): { rowCount: number; columnCount: number } {
    const keyValues: Record<string, unknown> = {};
    const listValues: Record<string, unknown[]> = {};

    for (const [key, value] of Object.entries(table)) {
      if (Array.isArray(value)) {
        listValues[key] = value;
      } else {
        keyValues[key] = value;
      }
    }

    return overwriteConfiguration(keyValues, listValues);
  }

  function getConfigurationTable(): ConfigTable {
    const lastRow = sheet.getLastRow();
    if (lastRow === 0) {
      return {};
    }

    const lastColumn = sheet.getLastColumn();
    const keyValues = sheet.getRange(1, 1, lastRow, 2).getValues();
    const data: ConfigTable = {};
    keyValues.forEach(([key, value]) => {
      if (key) {
        data[String(key)] = value;
      }
    });

    const listColumnCount = Math.max(lastColumn - 2, 0);
    if (listColumnCount > 0) {
      const listValues = sheet.getRange(1, 3, lastRow, listColumnCount).getValues();
      const valueListHeaders: string[] = [];
      for (let columnIndex = 0; columnIndex < listColumnCount; columnIndex += 1) {
        const header = String(listValues[0]?.[columnIndex] ?? "");
        valueListHeaders.push(header);
        if (!header) {
          continue;
        }
        const valueList: unknown[] = [];
        for (let rowIndex = 1; rowIndex < lastRow; rowIndex += 1) {
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
      return `${sheet.getParent().getUrl()}#gid=${sheetId}`;
    },
    getSheetId() {
      return sheetId;
    },
    loadConfigurationTable() {
      const startedAt = Date.now();
      this.table = getConfigurationTable();
      console.log(
        JSON.stringify({
          event: "ConfigurationSheet.loadConfigurationTable",
          sheetName,
          sheetId,
          durationMs: Date.now() - startedAt,
          keys: Object.keys(this.table).length,
        }),
      );
    },
    writeConfigurationTable(table?: ConfigTable) {
      if (table) {
        this.table = table;
      }
      const startedAt = Date.now();
      const dimensions = overwriteConfigurationTable(this.table);
      console.log(
        JSON.stringify({
          event: "ConfigurationSheet.writeConfigurationTable",
          sheetName,
          sheetId,
          durationMs: Date.now() - startedAt,
          keys: Object.keys(this.table).length,
          rows: dimensions.rowCount,
          columns: dimensions.columnCount,
        }),
      );
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
