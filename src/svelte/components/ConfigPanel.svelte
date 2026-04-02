<script lang="ts">
  import {
    Accordion,
    Button,
    Checkbox,
    Column,
    Columns,
    Fieldset,
    Form,
    FormItem,
    Inline,
    Input,
    Option,
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
    jobName = $bindable(""),
    sheet = $bindable(""),
    headerRows = $bindable(1),
    to = $bindable(""),
    cc = $bindable(""),
    bcc = $bindable(""),
    subject = $bindable(""),
    headers = [],
    selectedEmail = $bindable(""),
    selectedCc = $bindable(""),
    selectedBcc = $bindable(""),
    selectedSubject = $bindable(""),
    useMergeIf = $bindable(false),
    mergeCondition = $bindable<MergeCondition>(),
    specialConditions = [],
    onSaveConfig,
    onToggleEdit,
  }: {
    email?: string | undefined;
    loading?: boolean;
    editing?: boolean;
    jobName?: string;
    sheet?: string;
    headerRows?: number;
    to?: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    headers?: string[];
    selectedEmail?: string;
    selectedCc?: string;
    selectedBcc?: string;
    selectedSubject?: string;
    useMergeIf?: boolean;
    mergeCondition: MergeCondition;
    specialConditions?: SpecialCondition[];
    onSaveConfig: () => void;
    onToggleEdit: () => void;
  } = $props();

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

<Accordion>
  <details open>
    <summary>Configuration</summary>

    {#if loading}
      Loading configuration...
    {:else if editing}
      <Stack>
      <Inline gap="0.75rem" wrap="wrap" align="center">
        {email || "loading account..."}
        <Button secondary onclick={onToggleEdit}>View Summary</Button>
      </Inline>

      <Form onsubmit={(event) => event.preventDefault()}>
        <FormItem fullWidth>
          {#snippet label()}Job Name{/snippet}
          <Input type="text" bind:value={jobName} />
        </FormItem>

        <FormItem fullWidth>
          {#snippet label()}Sheet{/snippet}
          <Input type="text" bind:value={sheet} />
        </FormItem>

        <FormItem fullWidth>
          {#snippet label()}Header Rows{/snippet}
          <Input
            type="number"
            min="1"
            value={String(headerRows)}
            oninput={handleHeaderRowsChange}
          />
        </FormItem>

        <FormItem fullWidth>
          {#snippet label()}To{/snippet}
          <Input type="text" bind:value={to} placeholder={"{{Email}}"} />
          {#snippet after()}
            <Select
              bind:value={selectedEmail}
              onchange={() => appendRecipient("to", selectedEmail)}
            >
              <Option value="">Add field...</Option>
              {#each headers as h}
                <Option value={h}>{h}</Option>
              {/each}
            </Select>
          {/snippet}
        </FormItem>

        <FormItem fullWidth>
          {#snippet label()}CC{/snippet}
          <Input type="text" bind:value={cc} placeholder={"{{Email}}"} />
          {#snippet after()}
            <Select
              bind:value={selectedCc}
              onchange={() => appendRecipient("cc", selectedCc)}
            >
              <Option value="">Add field...</Option>
              {#each headers as h}
                <Option value={h}>{h}</Option>
              {/each}
            </Select>
          {/snippet}
        </FormItem>

        <FormItem fullWidth>
          {#snippet label()}BCC{/snippet}
          <Input type="text" bind:value={bcc} placeholder={"{{Email}}"} />
          {#snippet after()}
            <Select
              bind:value={selectedBcc}
              onchange={() => appendRecipient("bcc", selectedBcc)}
            >
              <Option value="">Add field...</Option>
              {#each headers as h}
                <Option value={h}>{h}</Option>
              {/each}
            </Select>
          {/snippet}
        </FormItem>

        <FormItem fullWidth>
          {#snippet label()}Subject{/snippet}
          <Input type="text" bind:value={subject} />
          {#snippet after()}
            <Select bind:value={selectedSubject} onchange={addSubjectField}>
              <Option value="">Add field...</Option>
              {#each headers as h}
                <Option value={h}>{h}</Option>
              {/each}
            </Select>
          {/snippet}
        </FormItem>
      </Form>

      <Fieldset>
        {#snippet legend()}Merge Conditions{/snippet}
        <Stack>
          <Checkbox bind:checked={useMergeIf}>Merge only certain rows</Checkbox>

          {#if useMergeIf}
            {#if !mergeCondition.doCustomFormula}
              <Columns>
                <Column>
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
                </Column>

                <Column>
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
                </Column>

                {#if needsValue(mergeCondition.selectedCondition)}
                  <Column>
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
                  </Column>
                {/if}
              </Columns>
            {:else}
              <FormItem fullWidth>
                {#snippet label()}Custom Formula{/snippet}
                <Input
                  type="text"
                  value={mergeCondition.customFormula}
                  oninput={(event) =>
                    updateMergeCondition({
                      customFormula: (event.currentTarget as HTMLInputElement)
                        .value,
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
              Write the formula for the first data row. It will be filled down
              automatically.
            </p>
          {/if}
        </Stack>
      </Fieldset>

      <Inline gap="0.75rem" wrap="wrap">
        <Button primary onclick={onSaveConfig}>Save Configuration</Button>
        <Button secondary onclick={onToggleEdit}>View Summary</Button>
      </Inline>
      </Stack>
    {:else}
      <Stack>
      <Inline gap="0.75rem" wrap="wrap" align="center">
        Saved configuration
        <Button secondary onclick={onToggleEdit}>Edit Config</Button>
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
            <td>{subject}</td>
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
