
export const GoogleAppsScript = {
  
     getActiveUserEmail(): Promise<string> {
      return new Promise((resolve, reject) => {
        google.script.run
          .withSuccessHandler((result: string) => resolve(result))
          .withFailureHandler((error: any) => reject(error))
          .getActiveUserEmail();
      });
    },

     loadSheetInfo(): Promise<import("../shared/mailMerge").SheetInfo> {
      return new Promise((resolve, reject) => {
        google.script.run
          .withSuccessHandler((result: import("../shared/mailMerge").SheetInfo) => resolve(result))
          .withFailureHandler((error: any) => reject(error))
          .loadSheetInfo();
      });
    },

     loadSheetConfig(): Promise<import("../shared/mailMerge").SheetConfigState> {
      return new Promise((resolve, reject) => {
        google.script.run
          .withSuccessHandler((result: import("../shared/mailMerge").SheetConfigState) => resolve(result))
          .withFailureHandler((error: any) => reject(error))
          .loadSheetConfig();
      });
    },

     loadSheetHeaders(): Promise<import("../shared/mailMerge").SheetHeaders> {
      return new Promise((resolve, reject) => {
        google.script.run
          .withSuccessHandler((result: import("../shared/mailMerge").SheetHeaders) => resolve(result))
          .withFailureHandler((error: any) => reject(error))
          .loadSheetHeaders();
      });
    },

     loadSheetShell(): Promise<import("../shared/mailMerge").SheetShell> {
      return new Promise((resolve, reject) => {
        google.script.run
          .withSuccessHandler((result: import("../shared/mailMerge").SheetShell) => resolve(result))
          .withFailureHandler((error: any) => reject(error))
          .loadSheetShell();
      });
    },

     loadSheetSampleRows(): Promise<import("../shared/mailMerge").SheetSampleRows> {
      return new Promise((resolve, reject) => {
        google.script.run
          .withSuccessHandler((result: import("../shared/mailMerge").SheetSampleRows) => resolve(result))
          .withFailureHandler((error: any) => reject(error))
          .loadSheetSampleRows();
      });
    },

     loadRawRows(limit: number): Promise<import("../shared/mailMerge").SheetRawRows> {
      return new Promise((resolve, reject) => {
        google.script.run
          .withSuccessHandler((result: import("../shared/mailMerge").SheetRawRows) => resolve(result))
          .withFailureHandler((error: any) => reject(error))
          .loadRawRows(limit);
      });
    },

     loadSidebarStatus(): Promise<import("../shared/mailMerge").SidebarStatus> {
      return new Promise((resolve, reject) => {
        google.script.run
          .withSuccessHandler((result: import("../shared/mailMerge").SidebarStatus) => resolve(result))
          .withFailureHandler((error: any) => reject(error))
          .loadSidebarStatus();
      });
    },

     saveMailMergeConfig(settings: { jobName: string; headerRows: number; to: string; cc: string; bcc: string; subject: string; useMergeIf: boolean; mergeFormula: string; trackReceipt: boolean; autoCheckReceipts: boolean; }): Promise<import("../shared/mailMerge").MailMergeConfig> {
      return new Promise((resolve, reject) => {
        google.script.run
          .withSuccessHandler((result: import("../shared/mailMerge").MailMergeConfig) => resolve(result))
          .withFailureHandler((error: any) => reject(error))
          .saveMailMergeConfig(settings);
      });
    },

     checkEmailReceipts(sheetName: string): Promise<import("../shared/mailMerge").CheckReceiptsResult> {
      return new Promise((resolve, reject) => {
        google.script.run
          .withSuccessHandler((result: import("../shared/mailMerge").CheckReceiptsResult) => resolve(result))
          .withFailureHandler((error: any) => reject(error))
          .checkEmailReceipts(sheetName);
      });
    },

     enableHourlyReceiptChecks(sheetName: string): Promise<import("../shared/mailMerge").MailMergeConfig> {
      return new Promise((resolve, reject) => {
        google.script.run
          .withSuccessHandler((result: import("../shared/mailMerge").MailMergeConfig) => resolve(result))
          .withFailureHandler((error: any) => reject(error))
          .enableHourlyReceiptChecks(sheetName);
      });
    },

     debugReceiptTracking(receiptId: string): Promise<import("../gas/mailMerge").ReceiptDebugResult> {
      return new Promise((resolve, reject) => {
        google.script.run
          .withSuccessHandler((result: import("../gas/mailMerge").ReceiptDebugResult) => resolve(result))
          .withFailureHandler((error: any) => reject(error))
          .debugReceiptTracking(receiptId);
      });
    },

     saveMailMergeTemplate(template: string): Promise<import("../shared/mailMerge").SheetInfo> {
      return new Promise((resolve, reject) => {
        google.script.run
          .withSuccessHandler((result: import("../shared/mailMerge").SheetInfo) => resolve(result))
          .withFailureHandler((error: any) => reject(error))
          .saveMailMergeTemplate(template);
      });
    },

     loadTestRows(): Promise<import("../shared/mailMerge").TestRow[]> {
      return new Promise((resolve, reject) => {
        google.script.run
          .withSuccessHandler((result: import("../shared/mailMerge").TestRow[]) => resolve(result))
          .withFailureHandler((error: any) => reject(error))
          .loadTestRows();
      });
    },

     sendMailMergeTestEmail(rowNumber: number, testAddress: string): Promise<import("../shared/mailMerge").SendTestEmailResult> {
      return new Promise((resolve, reject) => {
        google.script.run
          .withSuccessHandler((result: import("../shared/mailMerge").SendTestEmailResult) => resolve(result))
          .withFailureHandler((error: any) => reject(error))
          .sendMailMergeTestEmail(rowNumber, testAddress);
      });
    },

     runMailMerge(sheetName: string): Promise<import("../shared/mailMerge").MailMergeResult> {
      return new Promise((resolve, reject) => {
        google.script.run
          .withSuccessHandler((result: import("../shared/mailMerge").MailMergeResult) => resolve(result))
          .withFailureHandler((error: any) => reject(error))
          .runMailMerge(sheetName);
      });
    },

     openEditorDialog(): Promise<void> {
      return new Promise((resolve, reject) => {
        google.script.run
          .withSuccessHandler((result: void) => resolve(result))
          .withFailureHandler((error: any) => reject(error))
          .openEditorDialog();
      });
    }
}
