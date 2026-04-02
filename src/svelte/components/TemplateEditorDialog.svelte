<script lang="ts">
  import { onMount } from "svelte";
  import { Card, Container, Page, Stack } from "contain-css-svelte";
  import type { SheetInfo } from "../../shared/mailMerge";
  import { GoogleAppsScript } from "../gasApi";
  import BusyOverlay from "./BusyOverlay.svelte";
  import TemplateEditor from "./TemplateEditor.svelte";
  import { renderPreview } from "../lib/mailMerge";

  let ui = $state({
    busy: false,
    busyMessage: "",
    loading: true,
    errorMessage: "",
  });

  let editorState = $state({
    headers: [] as string[],
    sampleRows: [] as SheetInfo["sampleRows"],
    templateHtml: "",
  });

  const previewHtml = $derived(
    renderPreview(
      editorState.templateHtml,
      editorState.headers,
      editorState.sampleRows[0] ?? [],
    ),
  );

  function setBusy(message: string) {
    ui.busy = true;
    ui.busyMessage = message;
  }

  function clearBusy() {
    ui.busy = false;
    ui.busyMessage = "";
  }

  function formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  function hydrate(info: SheetInfo) {
    editorState.headers = info.headers ?? [];
    editorState.sampleRows = info.sampleRows ?? [];
    editorState.templateHtml = info.config?.template ?? "";
  }

  async function loadEditorState() {
    ui.loading = true;
    try {
      const info = await GoogleAppsScript.loadSheetInfo();
      hydrate(info);
      ui.errorMessage = "";
    } catch (error) {
      ui.errorMessage = formatError(error);
    } finally {
      ui.loading = false;
    }
  }

  async function saveTemplate() {
    setBusy("Saving template...");
    try {
      const info = await GoogleAppsScript.saveMailMergeTemplate(editorState.templateHtml);
      hydrate(info);
      ui.errorMessage = "";
      if (typeof google !== "undefined" && google.script?.host?.close) {
        google.script.host.close();
      }
    } catch (error) {
      ui.errorMessage = formatError(error);
    } finally {
      clearBusy();
    }
  }

  onMount(() => {
    void loadEditorState();
  });
</script>

<Page>
  <Container padding="0" --container-margin="0">
    <Stack>
    <BusyOverlay
      busy={ui.busy || ui.loading}
      message={ui.loading ? "Loading template and merge fields..." : ui.busyMessage}
    />

    {#if ui.errorMessage}
      <Card bg="#fff1f0" fg="#8f2f25">
        <p>{ui.errorMessage}</p>
      </Card>
    {/if}

    {#if !ui.loading}
      <TemplateEditor
        mode="editor"
        headers={editorState.headers}
        bind:templateHtml={editorState.templateHtml}
        {previewHtml}
        onSaveTemplate={saveTemplate}
      />
    {/if}
    </Stack>
  </Container>
</Page>
