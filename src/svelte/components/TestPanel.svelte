<script lang="ts">
  import {
    Accordion,
    Button,
    Column,
    Columns,
    FormItem,
    Inline,
    Input,
    Option,
    Select,
    Stack,
    Tag,
  } from "contain-css-svelte";

  type TestRow = { row: number; to: string };

  let {
    testRows = [],
    testRow = $bindable(""),
    testAddress = $bindable(""),
    testStatus = "",
    onSendTest,
  }: {
    testRows?: TestRow[];
    testRow?: string;
    testAddress?: string;
    testStatus?: string;
    onSendTest: () => void;
  } = $props();
</script>

<Accordion>
  <details open>
    <summary>Send Test Email</summary>

    <Stack>
      <Columns>
        <Column>
          <FormItem fullWidth>
            {#snippet label()}Pick Row{/snippet}
            <Select bind:value={testRow}>
              {#each testRows as r}
                <Option value={String(r.row)}>
                  Row {r.row}{r.to ? ` - ${r.to}` : ""}
                </Option>
              {/each}
            </Select>
          </FormItem>
        </Column>

        <Column>
          <FormItem fullWidth>
            {#snippet label()}Send To{/snippet}
            <Input type="email" bind:value={testAddress} />
          </FormItem>
        </Column>
      </Columns>

      <p>Uses saved configuration and template. CC/BCC are ignored.</p>

      <Inline gap="0.75rem" wrap="wrap" align="center">
        <Button primary onclick={onSendTest} disabled={!testRows.length}>
          Send Test Email
        </Button>
        {#if testStatus}
          <Tag>{testStatus}</Tag>
        {/if}
      </Inline>
    </Stack>
  </details>
</Accordion>
