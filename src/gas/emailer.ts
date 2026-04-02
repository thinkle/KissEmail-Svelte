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

export function embedTrackingPixel(htmlBody: string, pixelUrl: string): string {
  const pixel =
    `<img src="${pixelUrl}" width="1" height="1" alt="" ` +
    `style="display:block !important;border:0 !important;width:1px !important;height:1px !important;` +
    `margin:0 !important;padding:0 !important;opacity:0 !important;" />`;
  const closeBody = htmlBody.lastIndexOf("</body>");
  if (closeBody !== -1) {
    return htmlBody.slice(0, closeBody) + pixel + htmlBody.slice(closeBody);
  }
  return htmlBody + pixel;
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
