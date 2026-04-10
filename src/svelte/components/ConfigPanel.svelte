<script lang="ts">
  import type { ContentSource } from "../../shared/mailMerge";
  import {
    Accordion,
    Button,
    Checkbox,
    Dialog,
    Fieldset,
    Form,
    FormProvider,
    FormItem,
    Inline,
    Input,
    Option,
    Progress,
    Select,
    Stack,
    Table,
    Tag,
  } from "contain-css-svelte";

  type MergeCondition = {
    selectedHeader: string;
    selectedCondition: string;
    specialConditionText: string;
    doCustomFormula: boolean;
    customFormula: string;
  };

  type SpecialCondition = {
    label: string;
    formula: string;
    needsValue: boolean;
  };

  let {
    email,
    loading = false,
    editing = true,
    initiallyOpen = true,
    jobName = $bindable(""),
    sheet = $bindable(""),
    headerRows = $bindable(1),
    to = $bindable(""),
    cc = $bindable(""),
    bcc = $bindable(""),
    subject = $bindable(""),
    contentSource = "template",
    headers = [],
    selectedEmail = $bindable(""),
    selectedCc = $bindable(""),
    selectedBcc = $bindable(""),
    selectedSubject = $bindable(""),
    useMergeIf = $bindable(false),
    mergeCondition = $bindable<MergeCondition>(),
    specialConditions = [],
    trackReceipt = $bindable(false),
    autoCheckReceipts = $bindable(false),
    canCheckReceipts = true,
    canScheduleReceipts = true,
    saving = false,
    disabled = false,
    onSaveConfig,
    onToggleEdit,
  }: {
    email?: string | undefined;
    loading?: boolean;
    editing?: boolean;
    initiallyOpen?: boolean;
    jobName?: string;
    sheet?: string;
    headerRows?: number;
    to?: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    contentSource?: ContentSource;
    headers?: string[];
    selectedEmail?: string;
    selectedCc?: string;
    selectedBcc?: string;
    selectedSubject?: string;
    useMergeIf?: boolean;
    mergeCondition: MergeCondition;
    specialConditions?: SpecialCondition[];
    trackReceipt?: boolean;
    autoCheckReceipts?: boolean;
    canCheckReceipts?: boolean;
    canScheduleReceipts?: boolean;
    saving?: boolean;
    disabled?: boolean;
    onSaveConfig: () => void;
    onToggleEdit: () => void;
  } = $props();

  let open = $state(initiallyOpen);
  let aboutTrackingDialogOpen = $state(false);
  const subjectManagedByDraft = $derived(contentSource === "draft");

  const needsValue = (formula: string) =>
    specialConditions.find((c) => c.formula === formula)?.needsValue ?? false;

  function appendRecipient(target: "to" | "cc" | "bcc", field: string) {
    if (!field) {
      return;
    }
    const token = `{{${field}}}`;
    if (target === "to") {
      to = to ? `${to}, ${token}` : token;
      selectedEmail = "";
    } else if (target === "cc") {
      cc = cc ? `${cc}, ${token}` : token;
      selectedCc = "";
    } else {
      bcc = bcc ? `${bcc}, ${token}` : token;
      selectedBcc = "";
    }
  }

  function addSubjectField() {
    if (!selectedSubject) {
      return;
    }
    subject = `${subject}{{${selectedSubject}}}`;
    selectedSubject = "";
  }

  function updateMergeCondition(patch: Partial<MergeCondition>) {
    mergeCondition = { ...mergeCondition, ...patch };
  }

  function handleHeaderRowsChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    headerRows = Math.max(Number(input.value) || 1, 1);
  }
</script>

<FormProvider
  fullWidth
  layout="side"
  collapseSide={false}
  --form-label-width="120px"
  --form-input-width="260px"
>
  <Accordion>
    <details bind:open>
      <summary>Configuration</summary>

      {#if loading}
        Loading configuration...
      {:else if editing}
        <Stack>
          <Form onsubmit={(event) => event.preventDefault()}>
            <FormItem>
              {#snippet label()}Sheet{/snippet}
              <b>{sheet}</b>
            </FormItem>
            <FormItem>
              {#snippet label()}Subject{/snippet}
              <Stack>
                <Input
                  type="text"
                  bind:value={subject}
                  disabled={subjectManagedByDraft}
                  placeholder={subjectManagedByDraft
                    ? "Subject comes from the selected Gmail draft"
                    : undefined}
                />
                <Select
                  bind:value={selectedSubject}
                  onchange={addSubjectField}
                  disabled={subjectManagedByDraft}
                >
                  <Option value="">Add field...</Option>
                  {#each headers as h}
                    <Option value={h}>{h}</Option>
                  {/each}
                </Select>
                {#if subjectManagedByDraft}
                  <p>
                    Subject is taken from the selected Gmail draft in draft
                    mode.
                  </p>
                {/if}
              </Stack>
            </FormItem>

            <FormItem>
              {#snippet label()}Header Rows{/snippet}
              <Input
                type="number"
                min="1"
                value={String(headerRows)}
                oninput={handleHeaderRowsChange}
              />
            </FormItem>

            <FormItem>
              {#snippet label()}To{/snippet}
              <Stack>
                <Input type="text" bind:value={to} placeholder={"{{Email}}"} />
                <Select
                  bind:value={selectedEmail}
                  onchange={() => appendRecipient("to", selectedEmail)}
                >
                  <Option value="">Add field...</Option>
                  {#each headers as h}
                    <Option value={h}>{h}</Option>
                  {/each}
                </Select>
              </Stack>
            </FormItem>

            <FormItem>
              {#snippet label()}CC{/snippet}
              <Stack>
                <Input type="text" bind:value={cc} placeholder={"{{Email}}"} />
                <Select
                  bind:value={selectedCc}
                  onchange={() => appendRecipient("cc", selectedCc)}
                >
                  <Option value="">Add field...</Option>
                  {#each headers as h}
                    <Option value={h}>{h}</Option>
                  {/each}
                </Select>
              </Stack>
            </FormItem>

            <FormItem>
              {#snippet label()}BCC{/snippet}
              <Stack>
                <Input type="text" bind:value={bcc} placeholder={"{{Email}}"} />
                <Select
                  bind:value={selectedBcc}
                  onchange={() => appendRecipient("bcc", selectedBcc)}
                >
                  <Option value="">Add field...</Option>
                  {#each headers as h}
                    <Option value={h}>{h}</Option>
                  {/each}
                </Select>
              </Stack>
            </FormItem>
          </Form>

          <Fieldset>
            {#snippet legend()}Merge Conditions{/snippet}
            <Stack>
              <Checkbox bind:checked={useMergeIf}
                >Merge only certain rows</Checkbox
              >

              {#if useMergeIf}
                {#if !mergeCondition.doCustomFormula}
                  <FormItem fullWidth>
                    {#snippet label()}Column{/snippet}
                    <Select
                      value={mergeCondition.selectedHeader}
                      onchange={(event) =>
                        updateMergeCondition({
                          selectedHeader: (
                            event.currentTarget as HTMLSelectElement
                          ).value,
                        })}
                    >
                      {#each headers as h}
                        <Option value={h}>{h}</Option>
                      {/each}
                    </Select>
                  </FormItem>

                  <FormItem fullWidth>
                    {#snippet label()}Condition{/snippet}
                    <Select
                      value={mergeCondition.selectedCondition}
                      onchange={(event) =>
                        updateMergeCondition({
                          selectedCondition: (
                            event.currentTarget as HTMLSelectElement
                          ).value,
                        })}
                    >
                      {#each specialConditions as s}
                        <Option value={s.formula}>{s.label}</Option>
                      {/each}
                    </Select>
                  </FormItem>

                  {#if needsValue(mergeCondition.selectedCondition)}
                    <FormItem fullWidth>
                      {#snippet label()}Value{/snippet}
                      <Input
                        type="text"
                        value={mergeCondition.specialConditionText}
                        oninput={(event) =>
                          updateMergeCondition({
                            specialConditionText: (
                              event.currentTarget as HTMLInputElement
                            ).value,
                          })}
                      />
                    </FormItem>
                  {/if}
                {:else}
                  <FormItem fullWidth>
                    {#snippet label()}Custom Formula{/snippet}
                    <Input
                      type="text"
                      value={mergeCondition.customFormula}
                      oninput={(event) =>
                        updateMergeCondition({
                          customFormula: (
                            event.currentTarget as HTMLInputElement
                          ).value,
                        })}
                    />
                  </FormItem>
                {/if}

                <Checkbox
                  checked={mergeCondition.doCustomFormula}
                  onchange={(event) =>
                    updateMergeCondition({
                      doCustomFormula: (event.currentTarget as HTMLInputElement)
                        .checked,
                    })}
                >
                  Use custom formula
                </Checkbox>

                <p>
                  Write the formula for the first data row. It will be filled
                  down automatically.
                </p>
              {/if}
            </Stack>
          </Fieldset>

          <Fieldset>
            {#snippet legend()}
              <Inline
                >Receipt Tracking
                <Button onclick={() => (aboutTrackingDialogOpen = true)}>
                  Learn about tracking
                </Button>
              </Inline>
            {/snippet}
            <Stack>
              <Checkbox
                checked={trackReceipt}
                disabled={!canCheckReceipts}
                onchange={(event) => {
                  trackReceipt = (event.currentTarget as HTMLInputElement)
                    .checked;
                  if (!trackReceipt) {
                    autoCheckReceipts = false;
                  }
                }}
              >
                Track email opens (1×1 pixel)
              </Checkbox>
              <Checkbox
                bind:checked={autoCheckReceipts}
                disabled={!trackReceipt || !canScheduleReceipts}
              >
                Automatically check receipts hourly
              </Checkbox>
              {#if !canCheckReceipts}
                <p>Receipt tracking requires external-request permission.</p>
              {:else if !canScheduleReceipts}
                <p>Hourly auto-check requires trigger permission.</p>
              {/if}

              <Dialog
                --dialog-min-width="unset"
                --dialog-max-width="unset"
                --dialog-max-height="unset"
                --dialog-min-height="unset"
                open={aboutTrackingDialogOpen}
                onClose={() => (aboutTrackingDialogOpen = false)}
              >
                <div style="width: 80%; margin: 0 auto;">
                  <h2>About tracking</h2>
                  <p style="--font-size:0.85em;color:#555;margin:0.5em 0 0;">
                    A tiny invisible image is embedded in each email. When the
                    recipient opens it, their email client loads the image and
                    we record the time. Tracking isn't perfect — many clients
                    block remote images (Outlook, Thunderbird, and most
                    privacy-focused apps), so opens go unrecorded. Others like
                    Apple Mail on iOS 15+ go the other way: they pre-load images
                    automatically, which can log an "open" even if the email was
                    never read. <em>KISS</em>
                    is no less accurate than other tracking; we're just being transparent
                    about it!
                  </p>
                </div>
              </Dialog>
            </Stack>
          </Fieldset>

        <Inline gap="0.75rem" wrap="wrap">
          <Button primary onclick={onSaveConfig} disabled={saving || disabled}>
            {saving ? "Saving..." : "Save Configuration"}
          </Button>
        </Inline>
        {#if saving}
          <Stack>
            <Progress value={65} max={100} width="12rem" />
            <p>Saving configuration...</p>
          </Stack>
        {/if}
      </Stack>
      {:else}
        <Stack>
        <Inline gap="0.75rem" wrap="wrap" align="center">
          Saved configuration
          <Button onclick={onToggleEdit} disabled={disabled}>
            Edit Config
          </Button>
        </Inline>

          <Table --table-width="100%">
            <tbody>
              <tr>
                <th>Sheet</th>
                <td>{sheet}</td>
              </tr>
              <tr>
                <th>Header Rows</th>
                <td>{headerRows}</td>
              </tr>
              <tr>
                <th>To</th>
                <td>{to}</td>
              </tr>
              {#if cc}
                <tr>
                  <th>CC</th>
                  <td>{cc}</td>
                </tr>
              {/if}
              {#if bcc}
                <tr>
                  <th>BCC</th>
                  <td>{bcc}</td>
                </tr>
              {/if}
              <tr>
                <th>Subject</th>
                <td>
                  {#if subjectManagedByDraft}
                    From selected Gmail draft
                  {:else}
                    {subject}
                  {/if}
                </td>
              </tr>
              <tr>
                <th>Receipt Tracking</th>
                <td>{trackReceipt ? "enabled" : "disabled"}</td>
              </tr>
              <tr>
                <th>Auto Check</th>
                <td>{trackReceipt && autoCheckReceipts ? "hourly" : "off"}</td>
              </tr>
              <tr>
                <th>Merge Rows</th>
                <td>
                  {#if useMergeIf}
                    conditional using {mergeCondition.doCustomFormula
                      ? "custom formula"
                      : `${mergeCondition.selectedHeader} ${mergeCondition.selectedCondition}`}
                  {:else}
                    all rows
                  {/if}
                </td>
              </tr>
            </tbody>
          </Table>
        </Stack>
      {/if}
    </details>
  </Accordion>
</FormProvider>
