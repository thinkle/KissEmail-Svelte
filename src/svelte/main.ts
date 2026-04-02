import App from "./App.svelte";
import * as mockApi from "./mock/mockApi";
import { GoogleMock } from "google-apps-script-run-ts-mocks";
import { mount } from "svelte";

if (import.meta.env.DEV) {
  globalThis.google = new GoogleMock(mockApi);
}

const target = document.getElementById("app");
if (!target) {
  throw new Error("Missing #app element");
}

const app = mount(App, { target });

export default app;
