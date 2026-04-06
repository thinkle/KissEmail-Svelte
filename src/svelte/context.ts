import type { SheetConfigState, SheetShell } from "../shared/mailMerge";
import type { AddOnContext } from "./lib/parseContext";

export type AppView = "about" | "editor" | "templateEditor";

export type AppContext = AddOnContext & {
  view: AppView;
  initialSheetConfig?: SheetConfigState;
  initialSheetShell?: SheetShell;
};

export const DEFAULT_CONTEXT: AppContext = {
  addOn: "Sheets",
  container: "sidebar",
  view: "editor",
  //mode: "modal",
  localTesting: true,
};

function normalizeView(view: unknown): AppView {
  if (view === "about" || view === "editor" || view === "templateEditor") {
    return view;
  }
  return "editor";
}

function normalizeContext(context: Partial<AppContext>): AppContext {
  const view = normalizeView(context.view);
  const container = view === "editor" ? "sidebar" : "dialog";

  return {
    ...DEFAULT_CONTEXT,
    ...context,
    container,
    view,
  };
}

function getUrlContext(): Partial<AppContext> {
  if (typeof window === "undefined") {
    return {};
  }

  const view = new URL(window.location.href).searchParams.get("view");
  // Backward compatibility for older links/query params.
  if (view === "sidebar") {
    return { container: "sidebar", view: "editor", localTesting: true };
  }
  if (view === "editor") {
    return { container: "dialog", view: "templateEditor", localTesting: true };
  }
  if (view === "about" || view === "templateEditor") {
    return { container: "dialog", view, localTesting: true };
  }
  return {};
}

export function getAppContext(): AppContext {
  const urlContext = getUrlContext();
  if (typeof document === "undefined") {
    return normalizeContext(urlContext);
  }
  const el = document.getElementById("app-context");
  const raw = el?.textContent?.trim();
  if (!raw || raw[0] === "<") {
    return normalizeContext(urlContext);
  }
  try {
    const parsed = JSON.parse(raw) as AppContext;
    return normalizeContext(parsed);
  } catch {
    return normalizeContext(urlContext);
  }
}
