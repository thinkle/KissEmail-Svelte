export const DEFAULT_EMAIL_FONT_STACK =
  '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
export const DEFAULT_EMAIL_FONT_SIZE = "14px";
export const DEFAULT_EMAIL_LINE_HEIGHT = "1.45";
export const DEFAULT_EMAIL_TEXT_COLOR = "#1f2937";
export const DEFAULT_EMAIL_PADDING = "16px";

export const FONT_OPTIONS = [
  {
    value: "default",
    label: "Default",
    previewStyle: `font-family: ${DEFAULT_EMAIL_FONT_STACK};`,
  },
  {
    value: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    label: "System Sans",
    previewStyle:
      'font-family: "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;',
  },
  {
    value: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
    label: "Arial",
    previewStyle: 'font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;',
  },
  {
    value: "Verdana, Geneva, sans-serif",
    label: "Verdana",
    previewStyle: "font-family: Verdana, Geneva, sans-serif;",
  },
  {
    value: "Georgia, serif",
    label: "Georgia",
    previewStyle: "font-family: Georgia, serif;",
  },
  {
    value:
      '"Brush Script MT", "Segoe Script", "Snell Roundhand", "Comic Sans MS", cursive',
    label: "Cursive",
    previewStyle:
      'font-family: "Brush Script MT", "Segoe Script", "Snell Roundhand", "Comic Sans MS", cursive;',
  },
] as const;

export const FONT_SIZE_OPTIONS = [
  { value: "default", label: "Default", previewStyle: `font-size: ${DEFAULT_EMAIL_FONT_SIZE};` },
  { value: "13px", label: "Small", previewStyle: "font-size: 13px;" },
  { value: "14px", label: "Medium", previewStyle: "font-size: 14px;" },
  { value: "16px", label: "Large", previewStyle: "font-size: 16px;" },
  { value: "20px", label: "XL", previewStyle: "font-size: 20px;" },
] as const;

export const LINE_HEIGHT_OPTIONS = [
  { value: "default", label: "Default", previewStyle: `line-height: ${DEFAULT_EMAIL_LINE_HEIGHT};` },
  { value: "1.4", label: "1.4", previewStyle: "line-height: 1.4;" },
  { value: "1.8", label: "1.8", previewStyle: "line-height: 1.8;" },
] as const;
