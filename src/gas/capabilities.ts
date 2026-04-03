import type { AppCapabilities, CapabilityStatus } from "../shared/mailMerge";

const SCOPES = {
  currentSheet: "https://www.googleapis.com/auth/spreadsheets.currentonly",
  sendMail: "https://www.googleapis.com/auth/script.send_mail",
  externalRequest: "https://www.googleapis.com/auth/script.external_request",
  scriptApp: "https://www.googleapis.com/auth/script.scriptapp",
  gmailDrafts: "https://mail.google.com/",
} as const;

function getCapabilityStatus(scopes: string[]): CapabilityStatus {
  try {
    const info = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL, scopes);
    const status = info.getAuthorizationStatus();
    return {
      available: status === ScriptApp.AuthorizationStatus.NOT_REQUIRED,
      authUrl: info.getAuthorizationUrl() || null,
    };
  } catch {
    return {
      available: false,
      authUrl: null,
    };
  }
}

export function getCapabilities(): AppCapabilities {
  return {
    basicMailMerge: getCapabilityStatus([SCOPES.currentSheet, SCOPES.sendMail]),
    receiptChecks: getCapabilityStatus([
      SCOPES.currentSheet,
      SCOPES.sendMail,
      SCOPES.externalRequest,
    ]),
    receiptScheduling: getCapabilityStatus([
      SCOPES.currentSheet,
      SCOPES.sendMail,
      SCOPES.externalRequest,
      SCOPES.scriptApp,
    ]),
    gmailDrafts: getCapabilityStatus([SCOPES.gmailDrafts]),
  };
}
