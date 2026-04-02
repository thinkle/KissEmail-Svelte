<script lang="ts">
  import { getAppContext } from "./context";
  import AppSidebar from "./components/AppSidebar.svelte";
  import TemplateEditorDialog from "./components/TemplateEditorDialog.svelte";
  import "contain-css-svelte/vars/defaults.css";
  import "contain-css-svelte/themes/light.css";
  import "./app.css";

  const appContext = $state(getAppContext());
  const view = $derived(
    appContext.container === "dialog" ? "editor" : "sidebar",
  );
</script>

{#if view === "editor"}
  <TemplateEditorDialog />
{:else}
  <AppSidebar />
{/if}
