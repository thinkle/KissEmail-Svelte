<script lang="ts">
  import { onMount } from "svelte";
  import { Card, Container, Page, Stack } from "contain-css-svelte";
  import type {
    SheetConfigState,
    SheetHeaders,
    SheetRawRows,
    SheetSampleRows,
    SheetShell,
  } from "../../shared/mailMerge";
  import { GoogleAppsScript } from "../gasApi";
  import BusyOverlay from "./BusyOverlay.svelte";
  import TemplateEditor from "./TemplateEditor.svelte";
  import { getSampleRowsFromRaw, renderPreview } from "../lib/mailMerge";

  let {
    initialSheetConfig,
  }: {
    initialSheetConfig?: SheetConfigState;
  } = $props();

  let ui = $state({
    busy: false,
    busyMessage: "",
    loading: true,
    errorMessage: "",
  });

  let editorState = $state({
    headers: [] as string[],
    sampleRows: [] as SheetSampleRows["sampleRows"],
    templateHtml: "",
    headerRows: 1,
  });
  let rawRows = $state<SheetRawRows>({ rowNumbers: [], rows: [] });

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

  function hydrateConfig(info: SheetConfigState) {
    editorState.templateHtml = info.config?.template ?? "";
    editorState.headerRows = Math.max(Number(info.config?.headerRows) || 1, 1);
    editorState.sampleRows = getSampleRowsFromRaw(rawRows, editorState.headerRows);
  }

  function hydrateHeaders(info: SheetHeaders) {
    editorState.headers = info.headers ?? [];
  }

  function hydrateShell(info: SheetShell) {
    hydrateConfig(info);
    hydrateHeaders(info);
  }

  function hydrateRawRows(info: SheetRawRows) {
    rawRows = info;
    editorState.sampleRows = getSampleRowsFromRaw(rawRows, editorState.headerRows);
  }

  async function loadEditorState() {
    ui.loading = true;
    try {
      const configPromise = initialSheetConfig
        ? Promise.resolve(initialSheetConfig)
        : GoogleAppsScript.loadSheetConfig();
      const headersPromise = GoogleAppsScript.loadSheetHeaders();
      const rawRowsPromise = GoogleAppsScript.loadRawRows(10);
      const config = await configPromise;
      hydrateConfig(config);
      ui.errorMessage = "";
      ui.loading = false;

      void headersPromise
        .then((info) => {
          hydrateHeaders(info);
        })
        .catch((error) => {
          ui.errorMessage = formatError(error);
        });

      void rawRowsPromise
        .then((info) => {
          hydrateRawRows(info);
        })
        .catch((error) => {
          ui.errorMessage = formatError(error);
        });
    } catch (error) {
      ui.errorMessage = formatError(error);
      ui.loading = false;
    }
  }

  async function saveTemplate() {
    setBusy("Saving template...");
    try {
      const info = await GoogleAppsScript.saveMailMergeTemplate(editorState.templateHtml);
      hydrateShell(info);
      editorState.sampleRows = info.sampleRows ?? editorState.sampleRows;
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
