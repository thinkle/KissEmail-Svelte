import { spreadsheetify } from "./utils";

export type TableRow = Record<string, unknown>;
export type TableArray = Array<TableRow> & {
  headers: unknown[];
  sheet: GoogleAppsScript.Spreadsheet.Sheet;
  range: GoogleAppsScript.Spreadsheet.Range;
  pushRow: (data: Record<string, unknown> | unknown[]) => TableRow;
};

export function Table(
  range: GoogleAppsScript.Spreadsheet.Range,
  idHeader?: string
): TableArray {
  const values = range.getValues();
  const sheet = range.getSheet();
  const rowOffset = range.getRow();
  const colOffset = range.getColumn();
  const headers = values[0] ?? [];
  const rowsById: Record<string, TableRow> = {};

  function processRow(row: unknown[]): TableRow {
    const rowObj: TableRow = {};
    const rowNum = values.indexOf(row);

    function buildProperties(index: number, header: string) {
      if (Object.prototype.hasOwnProperty.call(rowObj, header)) {
        return;
      }

      Object.defineProperty(rowObj, header, {
        enumerable: true,
        get() {
          return row[index];
        },
        set(value) {
          sheet
            .getRange(Number(rowOffset) + Number(rowNum), Number(colOffset) + Number(index))
            .setValue(value);
          row[index] = value;
        },
      });

      Object.defineProperty(rowObj, index, {
        enumerable: true,
        get() {
          return row[index];
        },
        set(value) {
          row[index] = value;
          sheet.getRange(rowOffset + rowNum, colOffset + index).setValue(value);
        },
      });

      if (idHeader && header === idHeader) {
        rowsById[String(row[index])] = rowObj;
      }
    }

    headers.forEach((header, index) => buildProperties(index, String(header)));
    return rowObj;
  }

  const table = [] as unknown as TableArray;
  Object.defineProperty(table, "sheet", { value: sheet, writable: false });
  Object.defineProperty(table, "range", { value: range, writable: false });

  values.forEach((row) => table.push(processRow(row)));

  table.pushRow = function pushRow(data: Record<string, unknown> | unknown[]) {
    const pushArray = Array.from({ length: headers.length }, () => "");
    if (Array.isArray(data)) {
      data.forEach((value, index) => {
        pushArray[index] = spreadsheetify(value);
      });
    } else {
      for (const [key, value] of Object.entries(data)) {
        if (Number.isNaN(Number(key))) {
          const index = headers.indexOf(key);
          if (index > -1) {
            pushArray[index] = spreadsheetify(value);
          }
        } else {
          pushArray[Number(key)] = spreadsheetify(value);
        }
      }
    }
    if (!pushArray[headers.length - 1]) {
      pushArray[headers.length - 1] = "";
    }
    const appendRow = Array.from({ length: Math.max(colOffset - 1, 0) }, () => "").concat(
      pushArray
    );
    sheet.appendRow(appendRow);
    values.push(pushArray);
    const nextRow = processRow(pushArray);
    table.push(nextRow);
    return nextRow;
  };

  table.headers = headers;

  return table;
}
