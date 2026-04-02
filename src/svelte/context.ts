import type { AddOnContext } from "./lib/parseContext";

export type AppContext = AddOnContext & {
  view?: "sidebar" | "editor";
};

export const DEFAULT_CONTEXT: AppContext = {
  addOn: "Sheets",
  container: "sidebar",
  view: "sidebar",
  //mode: "modal",
  localTesting: true,
};

function normalizeContext(context: Partial<AppContext>): AppContext {
  const container = context.container === "dialog" ? "dialog" : "sidebar";
  return {
    ...DEFAULT_CONTEXT,
    ...context,
    container,
    view: container === "dialog" ? "editor" : "sidebar",
  };
}

function getUrlContext(): Partial<AppContext> {
  if (typeof window === "undefined") {
    return {};
  }

  const view = new URL(window.location.href).searchParams.get("view");
  if (view === "editor") {
    return { container: "dialog", view: "editor", localTesting: true };
  }
  if (view === "sidebar") {
    return { container: "sidebar", view: "sidebar", localTesting: true };
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
