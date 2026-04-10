<script lang="ts">
  import {
    Accordion,
    Button,
    Card,
    Dialog,
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
    disabled = false,
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
    disabled?: boolean;
    result?: CheckReceiptsResult | null;
    onCheckReceipts: () => void;
    onEnableAutoCheck: () => void;
  } = $props();

  let open = $state(initiallyOpen);
  let aboutTrackingDialogOpen = $state(false);
  const busy = $derived(Boolean(busyAction) || disabled);

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
        <Button
          onclick={() => (aboutTrackingDialogOpen = true)}
          disabled={busy}
        >
          About tracking
        </Button>
        <Table --table-width="100%">
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
              recipient opens it, their email client loads the image and we
              record the time. Tracking is not perfect: many clients block
              remote images (Outlook, Thunderbird, and privacy-focused apps), so
              opens can go unrecorded. Others, like Apple Mail on iOS 15+,
              pre-load images automatically, which can log an "open" even if the
              email was never read. KISS is no less accurate than other tracking
              tools; we are just transparent about it.
            </p>
          </div>
        </Dialog>

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
