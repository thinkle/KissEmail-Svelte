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
  trackReceipt: boolean;
  autoCheckReceipts: boolean;
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
  trackReceipt: boolean;
  autoCheckReceipts: boolean;
}

export interface ReceiptStatus {
  firstAccessed: string;
  lastAccessed: string;
  accessCount: number;
}

export interface CheckReceiptsResult {
  checked: number;
  received: number;
  pending: number;
}

export interface AutoReceiptStatus {
  enabled: boolean;
  lastCheckedAt?: string;
  lastCheckedPending?: number;
  lastError?: string;
}

export interface ReceiptSummary {
  tracked: number;
  opened: number;
  pending: number;
}

export interface SheetConfigState {
  config: MailMergeConfig;
  sheet: string;
}

export interface SheetHeaders {
  headers: string[];
}

export interface SheetShell extends SheetConfigState, SheetHeaders {}

export interface SheetSampleRows {
  sampleRows: SerializableCellValue[][];
}

export interface SheetRawRows {
  rowNumbers: number[];
  rows: SerializableCellValue[][];
}

export interface SidebarStatus {
  quota: number;
  autoReceiptStatus?: AutoReceiptStatus;
  receiptSummary?: ReceiptSummary;
}

export interface SheetInfo extends SheetShell, SheetSampleRows, SidebarStatus {}

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
