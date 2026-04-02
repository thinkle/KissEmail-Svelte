<script lang="ts">
  import { Accordion, Button, Card, Inline, Stack, Table, Tag } from "contain-css-svelte";
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
    result = null,
    onCheckReceipts,
    onEnableAutoCheck,
  }: {
    trackReceipt?: boolean;
    initiallyOpen?: boolean;
    receiptSummary?: ReceiptSummary;
    autoReceiptStatus?: AutoReceiptStatus;
    loading?: boolean;
    result?: CheckReceiptsResult | null;
    onCheckReceipts: () => void;
    onEnableAutoCheck: () => void;
  } = $props();

  let open = $state(initiallyOpen);

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
    <details bind:open={open}>
      <summary>Receipt Tracking</summary>
      <Stack>
        <Card>
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
        </Card>

        {#if result}
          <Card>
            <Inline wrap="wrap">
              <span><strong>{result.received}</strong> / {result.checked} opened</span>
              {#if result.pending > 0}
                <span>{result.pending} pending</span>
              {/if}
            </Inline>
          </Card>
        {/if}

        <Inline>
          {#if !autoReceiptStatus.enabled}
            <Button onclick={onEnableAutoCheck} disabled={loading}>
              Turn On Auto-check
            </Button>
          {/if}
          <Button onclick={onCheckReceipts} disabled={loading}>
            {loading ? "Checking…" : "Check Receipts"}
          </Button>
        </Inline>

        <p style="font-size:0.85em;color:#666;margin:0;">
          Updates the "Receipt Date" column for emails that have been opened.
        </p>
      </Stack>
    </details>
  </Accordion>
{/if}
