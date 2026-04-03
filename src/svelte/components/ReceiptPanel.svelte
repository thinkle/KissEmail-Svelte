<script lang="ts">
  import {
    Accordion,
    Button,
    Card,
    Inline,
    Stack,
    Table,
    Tag,
  } from "contain-css-svelte";
  import type {
    AutoReceiptStatus,
    CheckReceiptsResult,
    ReceiptSummary,
  } from "../../shared/mailMerge";

  let {
    trackReceipt = false,
    initiallyOpen = false,
    receiptSummary = { tracked: 0, opened: 0, pending: 0 },
    autoReceiptStatus = { enabled: false },
    loading = false,
    busyAction = null,
    result = null,
    onCheckReceipts,
    onEnableAutoCheck,
  }: {
    trackReceipt?: boolean;
    initiallyOpen?: boolean;
    receiptSummary?: ReceiptSummary;
    autoReceiptStatus?: AutoReceiptStatus;
    loading?: boolean;
    busyAction?: "checking" | "enabling" | null;
    result?: CheckReceiptsResult | null;
    onCheckReceipts: () => void;
    onEnableAutoCheck: () => void;
  } = $props();

  let open = $state(initiallyOpen);
  const busy = $derived(Boolean(busyAction));

  function formatTimestamp(value?: string): string {
    if (!value) {
      return "Not yet";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }
</script>

{#if trackReceipt && (receiptSummary.tracked > 0 || autoReceiptStatus.enabled || result)}
  <Accordion>
    <details bind:open>
      <summary>Receipt Tracking</summary>
      <Stack>
        <Table>
          <tbody>
            <tr>
              <th scope="row">Tracked emails</th>
              <td>{receiptSummary.tracked}</td>
            </tr>
            <tr>
              <th scope="row">Auto-check</th>
              <td>
                <Tag>{autoReceiptStatus.enabled ? "Hourly" : "Off"}</Tag>
              </td>
            </tr>
            {#if autoReceiptStatus.enabled}
              <tr>
                <th scope="row">Last run</th>
                <td>{formatTimestamp(autoReceiptStatus.lastCheckedAt)}</td>
              </tr>
              {#if typeof autoReceiptStatus.lastCheckedPending === "number"}
                <tr>
                  <th scope="row">Still pending</th>
                  <td>{autoReceiptStatus.lastCheckedPending}</td>
                </tr>
              {/if}
              {#if autoReceiptStatus.lastError}
                <tr>
                  <th scope="row">Last error</th>
                  <td>{autoReceiptStatus.lastError}</td>
                </tr>
              {/if}
            {/if}
          </tbody>
        </Table>

        {#if result}
          <Inline wrap="wrap">
            <span
              ><strong>{result.received}</strong> / {result.checked} opened</span
            >
            {#if result.pending > 0}
              <span>{result.pending} pending</span>
            {/if}
          </Inline>
        {/if}

        <Inline>
          {#if !autoReceiptStatus.enabled}
            <Button onclick={onEnableAutoCheck} disabled={busy}>
              {busyAction === "enabling"
                ? "Turning On..."
                : "Turn On Auto-check"}
            </Button>
          {/if}
          <Button onclick={onCheckReceipts} disabled={busy}>
            {busyAction === "checking" ? "Checking..." : "Check Receipts"}
          </Button>
        </Inline>

        {#if busyAction === "checking"}
          <Tag>Checking receipt status...</Tag>
        {:else if busyAction === "enabling"}
          <Tag>Registering hourly auto-check...</Tag>
        {/if}

        <p style="font-size:0.85em;color:#666;margin:0;">
          Updates the "Receipt Date" column for emails that have been opened.
        </p>
      </Stack>
    </details>
  </Accordion>
{/if}
