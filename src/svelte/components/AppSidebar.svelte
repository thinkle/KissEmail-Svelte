<script lang="ts">
  import { onMount } from "svelte";
  import kissEnvelopeSvg from "../lib/kiss-envelope.svg?raw";
  import {
    Accordion,
    Button,
    Card,
    Container,
    Inline,
    MiniButton,
    Stack,
    Tooltip,
    Tag,
    TextLayout,
    Dialog,
  } from "contain-css-svelte";
  import type {
    AutoReceiptStatus,
    MailMergeConfig,
    CheckReceiptsResult,
    ReceiptSummary,
    SaveMailMergeConfigInput,
    SheetConfigState,
    SheetHeaders,
    SheetRawRows,
    SheetSampleRows,
    SidebarStatus,
    TestRow,
  } from "../../shared/mailMerge";
  import { GoogleAppsScript } from "../gasApi";
  import BusyOverlay from "./BusyOverlay.svelte";
  import AboutKiss from "./AboutKiss.svelte";
  import ConfigPanel from "./ConfigPanel.svelte";
  import FooterBar from "./FooterBar.svelte";
  import ReceiptPanel from "./ReceiptPanel.svelte";
  import TemplateEditor from "./TemplateEditor.svelte";
  import TestPanel from "./TestPanel.svelte";
  import {
    SPECIAL_CONDITIONS,
    buildMergeFormula,
    configIsReady,
    defaultMergeCondition,
    getSampleRowsFromRaw,
    getTestRowsFromRaw,
    mergeConditionFromConfig,
    renderPreview,
    type MergeCondition,
  } from "../lib/mailMerge";

  let {
    initialSheetConfig,
  }: {
    initialSheetConfig?: SheetConfigState;
  } = $props();

  const emptyConfig = (): MailMergeConfig => ({
    jobName: "KISS Mail Merge",
    headerRows: 1,
    to: "",
    cc: "",
    bcc: "",
    subject: "",
    template: "",
    useMergeIf: false,
    mergeFormula: "",
    trackReceipt: true,
    autoCheckReceipts: false,
  });

  let ui = $state({
    email: "",
    busy: false,
    busyMessage: "",
    loading: true,
    merging: false,
    editing: true,
    errorMessage: "",
  });

  let sheetData = $state({
    headers: [] as string[],
    sampleRows: [] as SheetSampleRows["sampleRows"],
    quota: 0,
    sheet: "",
  });

  let config = $state(emptyConfig());

  let selection = $state({
    email: "",
    cc: "",
    bcc: "",
    subject: "",
  });

  let mergeCondition = $state<MergeCondition>(defaultMergeCondition());

  let test = $state({
    rows: [] as TestRow[],
    row: "",
    address: "",
    status: "",
  });

  let receiptResult = $state<CheckReceiptsResult | null>(null);
  let receiptChecking = $state(false);
  let receiptAction = $state<"checking" | "enabling" | null>(null);
  let autoReceiptStatus = $state<AutoReceiptStatus>({ enabled: false });
  let receiptSummary = $state<ReceiptSummary>({
    tracked: 0,
    opened: 0,
    pending: 0,
  });
  let configOpen = $state(true);
  let templateOpen = $state(true);
  let testOpen = $state(false);
  let receiptsOpen = $state(false);
  let aboutOpen = $state(false);
  let accordionStateInitialized = $state(false);

  let templatePollTimer: ReturnType<typeof setTimeout> | undefined;
  let templatePollBaseline = $state("");
  let templatePollAttempts = $state(0);
  let refreshToken = $state(0);
  let rawRows = $state<SheetRawRows>({ rowNumbers: [], rows: [] });

  const specialConditions = SPECIAL_CONDITIONS;

  const computedConfig = $derived({
    ...config,
    mergeFormula: buildMergeFormula(
      mergeCondition,
      sheetData.headers,
      config.headerRows,
    ),
  });

  const previewHtml = $derived(
    renderPreview(
      config.template,
      sheetData.headers,
      sheetData.sampleRows[0] ?? [],
    ),
  );
  const ready = $derived(configIsReady(computedConfig));
  const kissEnvelopeSrc = `data:image/svg+xml;utf8,${encodeURIComponent(kissEnvelopeSvg)}`;

  function formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  function setBusy(message: string) {
    ui.busy = true;
    ui.busyMessage = message;
  }

  function clearBusy() {
    ui.busy = false;
    ui.busyMessage = "";
  }

  function initializeAccordionState(nextConfig: MailMergeConfig) {
    const isReady = configIsReady(nextConfig);
    const hasTemplate = Boolean(nextConfig.template?.trim());

    if (nextConfig.autoCheckReceipts) {
      configOpen = false;
      templateOpen = false;
      testOpen = false;
      receiptsOpen = true;
    } else if (isReady) {
      configOpen = false;
      templateOpen = true;
      testOpen = true;
      receiptsOpen = false;
    } else {
      configOpen = true;
      templateOpen = !hasTemplate;
      testOpen = false;
      receiptsOpen = false;
    }

    accordionStateInitialized = true;
  }

  function hydrateConfig(info: SheetConfigState) {
    sheetData.sheet = info.sheet ?? "";
    const nextConfig = { ...emptyConfig(), ...(info.config ?? emptyConfig()) };
    config = nextConfig;
    mergeCondition = mergeConditionFromConfig(sheetData.headers, nextConfig);
    ui.editing = !configIsReady(nextConfig);

    if (!accordionStateInitialized) {
      initializeAccordionState(nextConfig);
    }

    rebuildDerivedRows();
  }

  function hydrateHeaders(info: SheetHeaders) {
    sheetData.headers = info.headers ?? [];
    mergeCondition = mergeConditionFromConfig(sheetData.headers, config);
    rebuildDerivedRows();
  }

  function rebuildDerivedRows() {
    sheetData.sampleRows = getSampleRowsFromRaw(rawRows, config.headerRows);
    test.rows = getTestRowsFromRaw(
      sheetData.headers,
      rawRows,
      config.headerRows,
      config.to,
    );

    if (!test.rows.length) {
      test.row = "";
      return;
    }
    if (
      !test.row ||
      !test.rows.some((row) => String(row.row) === String(test.row))
    ) {
      test.row = String(test.rows[0].row);
    }
  }

  function hydrateRawRows(info: SheetRawRows) {
    rawRows = info;
    rebuildDerivedRows();
  }

  function hydrateSidebarStatus(info: SidebarStatus) {
    sheetData.quota = info.quota ?? 0;
    autoReceiptStatus = info.autoReceiptStatus ?? { enabled: false };
    receiptSummary = info.receiptSummary ?? {
      tracked: 0,
      opened: 0,
      pending: 0,
    };
  }

  async function loadSheetConfig(token = refreshToken) {
    ui.loading = true;
    try {
      const info = await GoogleAppsScript.loadSheetConfig();
      if (token !== refreshToken) {
        return;
      }
      hydrateConfig(info);
      ui.errorMessage = "";
      if (!test.address && ui.email) {
        test.address = ui.email;
      }
    } catch (error) {
      if (token === refreshToken) {
        ui.errorMessage = formatError(error);
      }
    } finally {
      if (token === refreshToken) {
        ui.loading = false;
      }
    }
  }

  async function loadSheetHeaders(token = refreshToken) {
    try {
      const info = await GoogleAppsScript.loadSheetHeaders();
      if (token !== refreshToken) {
        return;
      }
      hydrateHeaders(info);
    } catch (error) {
      if (token === refreshToken) {
        ui.errorMessage = formatError(error);
      }
    }
  }

  async function loadRawRows(token = refreshToken) {
    try {
      const info = await GoogleAppsScript.loadRawRows(60);
      if (token !== refreshToken) {
        return;
      }
      hydrateRawRows(info);
    } catch (error) {
      if (token === refreshToken) {
        ui.errorMessage = formatError(error);
      }
    }
  }

  async function loadSidebarStatus(token = refreshToken) {
    try {
      const info = await GoogleAppsScript.loadSidebarStatus();
      if (token !== refreshToken) {
        return;
      }
      hydrateSidebarStatus(info);
    } catch (error) {
      if (token === refreshToken) {
        ui.errorMessage = formatError(error);
      }
    }
  }

  function loadSidebarSupplements(token = refreshToken) {
    void loadSheetHeaders(token);
    void loadRawRows(token);
    void loadSidebarStatus(token);
  }

  async function refreshSidebar() {
    const token = refreshToken + 1;
    refreshToken = token;
    await loadSheetConfig(token);
    loadSidebarSupplements(token);
  }

  async function refreshSidebarStatusOnly() {
    const token = refreshToken + 1;
    refreshToken = token;
    await loadSidebarStatus(token);
  }

  async function refreshTemplatePreviewData() {
    const token = refreshToken + 1;
    refreshToken = token;
    await loadRawRows(token);
  }

  async function loadInitialSidebar() {
    const token = refreshToken + 1;
    refreshToken = token;

    const emailPromise = GoogleAppsScript.getActiveUserEmail().catch(() => "");
    if (initialSheetConfig) {
      hydrateConfig(initialSheetConfig);
      ui.loading = false;
      ui.errorMessage = "";
    } else {
      await loadSheetConfig(token);
    }

    ui.email = await emailPromise;
    if (!test.address && ui.email) {
      test.address = ui.email;
    }
    loadSidebarSupplements(token);
  }

  async function saveConfig() {
    const payload: SaveMailMergeConfigInput = {
      jobName: config.jobName,
      headerRows: config.headerRows,
      to: config.to,
      cc: config.cc,
      bcc: config.bcc,
      subject: config.subject,
      useMergeIf: config.useMergeIf,
      mergeFormula: computedConfig.mergeFormula,
      trackReceipt: config.trackReceipt,
      autoCheckReceipts: config.trackReceipt ? config.autoCheckReceipts : false,
    };

    setBusy("Saving configuration...");
    try {
      await GoogleAppsScript.saveMailMergeConfig(payload);
      ui.editing = false;
      ui.errorMessage = "";
      await refreshSidebar();
    } catch (error) {
      ui.errorMessage = formatError(error);
    } finally {
      clearBusy();
    }
  }

  function stopTemplatePolling() {
    if (templatePollTimer) {
      clearTimeout(templatePollTimer);
      templatePollTimer = undefined;
    }
  }

  async function pollTemplateUpdate() {
    templatePollAttempts += 1;
    try {
      const info = await GoogleAppsScript.loadSheetConfig();
      if (info.config.template !== templatePollBaseline) {
        hydrateConfig(info);
        void refreshTemplatePreviewData();
        stopTemplatePolling();
        return;
      }
    } catch {
      stopTemplatePolling();
      return;
    }

    if (templatePollAttempts < 45) {
      templatePollTimer = window.setTimeout(pollTemplateUpdate, 400);
    } else {
      stopTemplatePolling();
    }
  }

  async function openEditor() {
    setBusy("Opening editor...");
    try {
      templatePollBaseline = config.template;
      templatePollAttempts = 0;
      await GoogleAppsScript.openEditorDialog();
      stopTemplatePolling();
      templatePollTimer = window.setTimeout(pollTemplateUpdate, 400);
    } catch (error) {
      ui.errorMessage = formatError(error);
    } finally {
      clearBusy();
    }
  }

  async function doSetup() {
    await refreshSidebar();
  }

  async function doMerge() {
    setBusy("Sending mail merge...");
    ui.merging = true;
    try {
      const result = await GoogleAppsScript.runMailMerge(sheetData.sheet);
      test.status = `Sent ${result.successful} email${
        result.successful === 1 ? "" : "s"
      }${result.errors ? `, ${result.errors} error${result.errors === 1 ? "" : "s"}` : ""}.`;
      ui.errorMessage = "";
      await refreshSidebar();
    } catch (error) {
      ui.errorMessage = formatError(error);
    } finally {
      ui.merging = false;
      clearBusy();
    }
  }

  async function sendTestEmail() {
    if (!test.row) {
      test.status = "Please choose a row.";
      return;
    }
    if (!test.address) {
      test.status = "Please enter a test email address.";
      return;
    }

    setBusy("Sending test email...");
    try {
      const result = await GoogleAppsScript.sendMailMergeTestEmail(
        Number(test.row),
        test.address,
      );
      test.status = `Test email sent to ${result.to}.`;
      ui.errorMessage = "";
    } catch (error) {
      test.status = "";
      ui.errorMessage = formatError(error);
    } finally {
      clearBusy();
    }
  }

  async function checkReceipts() {
    receiptChecking = true;
    receiptAction = "checking";
    try {
      receiptResult = await GoogleAppsScript.checkEmailReceipts(
        sheetData.sheet,
      );
      ui.errorMessage = "";
      await refreshSidebarStatusOnly();
    } catch (error) {
      ui.errorMessage = formatError(error);
    } finally {
      receiptChecking = false;
      receiptAction = null;
    }
  }

  async function enableAutoReceiptChecks() {
    if (!config.trackReceipt || autoReceiptStatus.enabled) {
      console.log("enableAutoReceiptChecks.skipped", {
        trackReceipt: config.trackReceipt,
        autoReceiptStatusEnabled: autoReceiptStatus.enabled,
        configAutoCheckReceipts: config.autoCheckReceipts,
        sheet: sheetData.sheet,
      });
      return;
    }

    console.log("enableAutoReceiptChecks.start", {
      sheet: sheetData.sheet,
      trackReceipt: config.trackReceipt,
      configAutoCheckReceipts: config.autoCheckReceipts,
      autoReceiptStatusEnabled: autoReceiptStatus.enabled,
    });
    receiptAction = "enabling";
    try {
      await GoogleAppsScript.enableHourlyReceiptChecks(sheetData.sheet);
      console.log("enableAutoReceiptChecks.success", {
        sheet: sheetData.sheet,
      });
      config.autoCheckReceipts = true;
      ui.errorMessage = "";
      await refreshSidebarStatusOnly();
    } catch (error) {
      console.error("enableAutoReceiptChecks.error", error);
      ui.errorMessage = formatError(error);
    } finally {
      receiptAction = null;
    }
  }

  async function initializeSidebar() {
    try {
      await loadInitialSidebar();
    } catch {
      ui.email = "";
    }
  }

  function openAbout() {
    aboutOpen = true;
  }

  function closeAbout() {
    aboutOpen = false;
  }

  onMount(() => {
    void initializeSidebar();
    return () => {
      stopTemplatePolling();
    };
  });
</script>

<Container
  padding="0"
  --container-margin="0"
  --font-size="12px"
  --button-font-size="12px"
  --heading-font-size="1.1rem"
>
  {#if sheetData.headers.length === 0}
    <Container padding="8px">
      <Inline
        ><h1>Your Sheet is Empty!</h1>
        <Button primary onclick={doSetup}>Reload</Button>
      </Inline>
      <AboutKiss onEditTemplate={openEditor}></AboutKiss>
      <Card>
        {#snippet header()}
          Wrong sheet?
        {/snippet}
        <p>
          If you're on the wrong sheet, just change sheets and click
          <a href="#" onclick={doSetup}>reload</a>.
        </p>
      </Card>
    </Container>
  {:else}
    <Stack>
      <BusyOverlay busy={ui.busy} message={ui.busyMessage} />
      <Inline>
        <Inline gap="0" align="center">
          <img
            src={kissEnvelopeSrc}
            alt="KISS Mail Merge"
            width="32"
            height="32"
          />
          <h1 style="margin:0;font-size:1.2rem;">
            <Tooltip tooltipText="Keep it simple, stupid :-)"
              ><span style="inline-block">KISS</span></Tooltip
            >
            Mail Merge
          </h1>
        </Inline>
        <Tooltip tooltipText="Reload">
          <MiniButton onclick={doSetup}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              width="16"
              height="16"
            >
              <path
                d="M12 4V1L8 5l3.99 4V6c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"
              />
            </svg>
          </MiniButton>
        </Tooltip>
        <Button onclick={openAbout}>About</Button>
      </Inline>

      {#if ui.errorMessage}
        <Card bg="#fff1f0" fg="#8f2f25">
          <p>{ui.errorMessage}</p>
        </Card>
      {/if}

      {#if aboutOpen}
        <Dialog
          onclose={closeAbout}
          dismissible
          --dialog-min-width="unset"
          --dialog-max-width="unset"
          --dialog-max-height="unset"
          --dialog-min-height="unset"
        >
          <div style="max-height:calc(100vh - 4.5rem); overflow:auto;">
            <AboutKiss onEditTemplate={openEditor} />
          </div>
        </Dialog>
      {/if}

      <ConfigPanel
        email={ui.email}
        loading={ui.loading}
        editing={ui.editing}
        initiallyOpen={configOpen}
        bind:jobName={config.jobName}
        bind:sheet={sheetData.sheet}
        bind:headerRows={config.headerRows}
        bind:to={config.to}
        bind:cc={config.cc}
        bind:bcc={config.bcc}
        bind:subject={config.subject}
        headers={sheetData.headers}
        bind:selectedEmail={selection.email}
        bind:selectedCc={selection.cc}
        bind:selectedBcc={selection.bcc}
        bind:selectedSubject={selection.subject}
        bind:useMergeIf={config.useMergeIf}
        bind:mergeCondition
        {specialConditions}
        bind:trackReceipt={config.trackReceipt}
        bind:autoCheckReceipts={config.autoCheckReceipts}
        onSaveConfig={saveConfig}
        onToggleEdit={() => (ui.editing = true)}
      />

      <Accordion>
        <details bind:open={templateOpen}>
          <summary>Email Template</summary>
          <TemplateEditor
            mode="sidebar"
            headers={sheetData.headers}
            bind:templateHtml={config.template}
            {previewHtml}
            onOpenEditor={openEditor}
          />
        </details>
      </Accordion>

      <TestPanel
        initiallyOpen={testOpen}
        testRows={test.rows}
        bind:testRow={test.row}
        bind:testAddress={test.address}
        testStatus={test.status}
        onSendTest={sendTestEmail}
      />

      <ReceiptPanel
        trackReceipt={config.trackReceipt}
        initiallyOpen={receiptsOpen}
        {receiptSummary}
        {autoReceiptStatus}
        loading={receiptChecking}
        busyAction={receiptAction}
        result={receiptResult}
        onCheckReceipts={checkReceipts}
        onEnableAutoCheck={enableAutoReceiptChecks}
      />

      <FooterBar {ready} merging={ui.merging} onMerge={doMerge} />

      <Stack>
        {#if sheetData.quota}
          You can send {sheetData.quota} more emails today.
        {/if}
        <p>KISS Mail Merge for Google Sheets.</p>
      </Stack>
    </Stack>
  {/if}
</Container>
