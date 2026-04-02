import { spreadsheetify } from "./utils";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function sendEmail(
  email: string,
  subject: string,
  htmlBody: string,
  options?: { cc?: string; bcc?: string }
) {
  const params: GoogleAppsScript.Mail.MailAdvancedParameters & {
    to: string;
    subject: string;
    htmlBody: string;
  } = {
    to: email,
    subject,
    htmlBody,
  };

  if (options?.cc) {
    params.cc = options.cc;
  }
  if (options?.bcc) {
    params.bcc = options.bcc;
  }

  MailApp.sendEmail(params);
}

export function applyTemplate(
  template: string,
  fields: Record<string, unknown>,
  fixWhiteSpace = false
): string {
  let output = template ?? "";
  if (fixWhiteSpace) {
    output = output.replace(/\n/g, "<br>");
  }

  for (const [target, fieldValue] of Object.entries(fields)) {
    let replacement = String(spreadsheetify(fieldValue));
    if (fixWhiteSpace) {
      replacement = replacement.replace(/\n/g, "<br>");
    }
    output = output.replace(
      new RegExp(escapeRegExp(`{{${target}}}`), "g"),
      replacement
    );
  }

  return output;
}

export function sendEmailFromTemplate(
  emailTemplate: string,
  subjectTemplate: string,
  template: string,
  fields: Record<string, unknown>,
  fixWhiteSpace = false,
  ccTemplate = "",
  bccTemplate = ""
) {
  const to = applyTemplate(emailTemplate, fields);
  const subject = applyTemplate(subjectTemplate, fields);
  const body = applyTemplate(template, fields, fixWhiteSpace);
  const options: { cc?: string; bcc?: string } = {};
  const cc = ccTemplate ? applyTemplate(ccTemplate, fields) : "";
  const bcc = bccTemplate ? applyTemplate(bccTemplate, fields) : "";
  if (cc) {
    options.cc = cc;
  }
  if (bcc) {
    options.bcc = bcc;
  }
  sendEmail(to, subject, body, options);
}
