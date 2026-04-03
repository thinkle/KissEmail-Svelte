
declare namespace google.script {  
  interface GoogleScriptRun {
      withFailureHandler(callback: (error: Error, object?: any) => void): this;
      withSuccessHandler(callback: (value: any, object?: any) => void): this;
      withUserObject(object: Object): this;
      getActiveUserEmail(): void;
  loadSheetInfo(): void;
  loadSheetConfig(): void;
  loadSheetHeaders(): void;
  loadSheetShell(): void;
  loadSheetSampleRows(): void;
  loadRawRows(limit: number): void;
  loadSidebarStatus(): void;
  loadRecentDrafts(limit: number): void;
  loadDraftTemplate(draftId: string): void;
  saveMailMergeConfig(settings: Partial<import("/Users/thinkle/BackedUpProjects/gas/KissEmail-Svelte/src/shared/mailMerge").SaveMailMergeConfigInput>): void;
  checkEmailReceipts(sheetName: string): void;
  enableHourlyReceiptChecks(sheetName: string): void;
  debugReceiptTracking(receiptId: string): void;
  saveMailMergeTemplate(template: string): void;
  loadTestRows(): void;
  sendMailMergeTestEmail(rowNumber: number, testAddress: string): void;
  runMailMerge(sheetName: string): void;
  openEditorDialog(): void
  }
  const run : GoogleScriptRun;

  interface GoogleScriptHost {
  close(): void;
  setHeight(height: number): void;
  setWidth(width: number): void;
  editor: {
    focus(): void;
  };
}
const host : GoogleScriptHost;
  

  interface IUrlLocation {
  hash: string;
  parameter: { [key: string]: any };
  parameters: { [key: string]: any[] };
}

interface GoogleScriptUrl {
  getLocation(callback: (location: IUrlLocation) => void): void;
}
const url : GoogleScriptUrl;
  
}
