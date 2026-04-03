import App from "./App.svelte";
import GoogleMock from "./mock/mockGoogle";
import { mount } from "svelte";

if (import.meta.env.DEV) {
  globalThis.google = GoogleMock;
}

const target = document.getElementById("app");
if (!target) {
  throw new Error("Missing #app element");
}

const app = mount(App, { target });

export default app;
