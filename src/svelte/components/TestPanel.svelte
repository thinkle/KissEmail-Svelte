<script lang="ts">
  import {
    Accordion,
    Button,
    FormItem,
    Inline,
    Input,
    Option,
    Progress,
    Select,
    Stack,
    Tag,
  } from "contain-css-svelte";

  type TestRow = { row: number; to: string };

  let {
    initiallyOpen = true,
    testRows = [],
    testRow = $bindable(""),
    testAddress = $bindable(""),
    testStatus = "",
    sending = false,
    disabled = false,
    onSendTest,
  }: {
    initiallyOpen?: boolean;
    testRows?: TestRow[];
    testRow?: string;
    testAddress?: string;
    testStatus?: string;
    sending?: boolean;
    disabled?: boolean;
    onSendTest: () => void;
  } = $props();

  let open = $state(initiallyOpen);
</script>

<Accordion>
  <details bind:open={open}>
    <summary>Send Test Email</summary>

    <Stack>
      <FormItem fullWidth>
        {#snippet label()}Pick Row{/snippet}
        <Select bind:value={testRow} disabled={sending || disabled}>
          {#each testRows as r}
            <Option value={String(r.row)}>
              Row {r.row}{r.to ? ` - ${r.to}` : ""}
            </Option>
          {/each}
        </Select>
      </FormItem>

      <FormItem fullWidth>
        {#snippet label()}Send To{/snippet}
        <Input
          type="email"
          bind:value={testAddress}
          disabled={sending || disabled}
        />
      </FormItem>

      <p>Uses saved configuration and the selected template or Gmail draft. CC/BCC are ignored.</p>

      <Inline gap="0.75rem" wrap="wrap" align="center">
        <Button
          primary
          onclick={onSendTest}
          disabled={!testRows.length || sending || disabled}
        >
          {sending ? "Sending..." : "Send Test Email"}
        </Button>
        {#if testStatus}
          <Tag>{testStatus}</Tag>
        {/if}
      </Inline>
      {#if sending}
        <Stack>
          <Progress value={65} max={100} width="12rem" />
          <p>Sending test email...</p>
        </Stack>
      {/if}
    </Stack>
  </details>
</Accordion>
