import type {
  MailMergeConfig,
  MailMergeResult,
  SendTestEmailResult,
  SheetInfo,
  TestRow,
} from "../../shared/mailMerge";

export const mockConfig: MailMergeConfig = {
  jobName: "KISS Mail Merge",
  headerRows: 1,
  to: "{{Email}}",
  cc: "",
  bcc: "",
  subject: "Hello {{FirstName}}",
  template: "<p>Hi {{FirstName}},</p><p>This is a mock preview email.</p>",
  useMergeIf: false,
  mergeFormula: "",
  trackReceipt: true,
};

export const mockSheetInfo = (): SheetInfo => ({
  headers: ["Email", "FirstName", "LastName", "Grade"],
  config: { ...mockConfig },
  sampleRows: [
    ["ava.ng@example.com", "Ava", "Ng", 10],
    ["sam.cho@example.com", "Sam", "Cho", 11],
  ],
  quota: 1500,
  sheet: "Contacts",
});

export const mockTestRows = (): TestRow[] => [
  { row: 2, to: "ava.ng@example.com" },
  { row: 3, to: "sam.cho@example.com" },
];

export const mockMergeResult = (): MailMergeResult => ({
  successful: 2,
  errors: 0,
});

export const mockSendTestResult = (
  rowNumber: number,
  testAddress: string,
): SendTestEmailResult => ({
  row: rowNumber,
  to: testAddress,
});
