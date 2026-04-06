<script lang="ts">
  import { getAppContext } from "./context";
  import AboutKiss from "./components/AboutKiss.svelte";
  import AppSidebar from "./components/AppSidebar.svelte";
  import TemplateEditorDialog from "./components/TemplateEditorDialog.svelte";
  import "contain-css-svelte/vars/defaults.css";
  import "contain-css-svelte/themes/light.css";
  import "./app.css";

  const appContext = $state(getAppContext());
  const view = $derived(appContext.view);
</script>

{#if view === "about"}
  <AboutKiss />
{:else if view === "templateEditor"}
  <TemplateEditorDialog
    initialSheetConfig={appContext.initialSheetConfig}
    initialSheetShell={appContext.initialSheetShell}
  />
{:else}
  <AppSidebar
    initialSheetConfig={appContext.initialSheetConfig}
    initialSheetShell={appContext.initialSheetShell}
  />
{/if}
