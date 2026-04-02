import type {
  MailMergeConfig,
  SerializableCellValue,
} from "../../shared/mailMerge";

export type MergeCondition = {
  selectedHeader: string;
  selectedCondition: string;
  specialConditionText: string;
  doCustomFormula: boolean;
  customFormula: string;
};

export type SpecialCondition = {
  label: string;
  formula: string;
  needsValue: boolean;
};

export const SPECIAL_CONDITIONS: SpecialCondition[] = [
  { label: "is blank", formula: "BLANK", needsValue: false },
  { label: "is not blank", formula: "NOT_BLANK", needsValue: false },
  { label: "equals", formula: "EQUALS", needsValue: true },
  { label: "does not equal", formula: "NOT_EQUALS", needsValue: true },
  { label: "contains", formula: "CONTAINS", needsValue: true },
];

export function defaultMergeCondition(headers: string[] = []): MergeCondition {
  return {
    selectedHeader: headers.find(Boolean) ?? "",
    selectedCondition: "NOT_BLANK",
    specialConditionText: "",
    doCustomFormula: false,
    customFormula: "",
  };
}

function getColumnRef(columnNumber: number, rowNumber: number): string {
  let current = columnNumber;
  let output = "";
  while (current > 0) {
    const remainder = (current - 1) % 26;
    output = String.fromCharCode(65 + remainder) + output;
    current = Math.floor((current - 1) / 26);
  }
  return `${output}${rowNumber}`;
}

function quoteFormulaValue(value: string): string {
  if (value.trim() !== "" && !Number.isNaN(Number(value))) {
    return value.trim();
  }
  return `"${value.replace(/"/g, '""')}"`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildMergeFormula(
  mergeCondition: MergeCondition,
  headers: string[],
  headerRows: number
): string {
  if (mergeCondition.doCustomFormula) {
    return mergeCondition.customFormula.trim();
  }

  const columnIndex = headers.indexOf(mergeCondition.selectedHeader) + 1;
  if (columnIndex <= 0) {
    return "";
  }

  const cellReference = getColumnRef(columnIndex, Number(headerRows || 1) + 1);
  switch (mergeCondition.selectedCondition) {
    case "BLANK":
      return `=LEN(TRIM(TO_TEXT(${cellReference})))=0`;
    case "NOT_BLANK":
      return `=LEN(TRIM(TO_TEXT(${cellReference})))>0`;
    case "EQUALS":
      return `=${cellReference}=${quoteFormulaValue(
        mergeCondition.specialConditionText
      )}`;
    case "NOT_EQUALS":
      return `=${cellReference}<>${quoteFormulaValue(
        mergeCondition.specialConditionText
      )}`;
    case "CONTAINS":
      return `=REGEXMATCH(TO_TEXT(${cellReference}),"${escapeRegex(
        mergeCondition.specialConditionText
      )}")`;
    default:
      return "";
  }
}

export function mergeConditionFromConfig(
  headers: string[],
  config: MailMergeConfig
): MergeCondition {
  const base = defaultMergeCondition(headers);
  if (config.useMergeIf && config.mergeFormula) {
    return {
      ...base,
      doCustomFormula: true,
      customFormula: config.mergeFormula,
    };
  }
  return base;
}

export function renderPreview(
  html: string,
  headers: string[],
  sampleRow: SerializableCellValue[]
): string {
  const rowObject = Object.fromEntries(
    headers.map((header, index) => [header, sampleRow[index] ?? ""])
  );

  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => {
    const value = rowObject[key];
    return value === null || value === undefined ? match : String(value);
  });
}

export function configIsReady(config: MailMergeConfig): boolean {
  return Boolean(
    config.template.trim() &&
      config.to.trim() &&
      config.subject.trim() &&
      (!config.useMergeIf || config.mergeFormula.trim())
  );
}
