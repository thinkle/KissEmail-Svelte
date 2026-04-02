export type SerializableCellValue = string | number | boolean | null;

export interface MailMergeConfig {
  jobName: string;
  headerRows: number;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  template: string;
  useMergeIf: boolean;
  mergeFormula: string;
}

export interface SaveMailMergeConfigInput {
  jobName: string;
  headerRows: number;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  useMergeIf: boolean;
  mergeFormula: string;
}

export interface SheetInfo {
  headers: string[];
  config: MailMergeConfig;
  sampleRows: SerializableCellValue[][];
  quota: number;
  sheet: string;
}

export interface TestRow {
  row: number;
  to: string;
}

export interface SendTestEmailResult {
  row: number;
  to: string;
}

export interface MailMergeResult {
  successful: number;
  errors: number;
}
