<script lang="ts">
  import { Accordion, Button, Card, Inline, Stack } from "contain-css-svelte";
  import type { CheckReceiptsResult } from "../../shared/mailMerge";

  let {
    trackReceipt = false,
    loading = false,
    result = null,
    onCheckReceipts,
  }: {
    trackReceipt?: boolean;
    loading?: boolean;
    result?: CheckReceiptsResult | null;
    onCheckReceipts: () => void;
  } = $props();
</script>

{#if trackReceipt}
  <Accordion>
    <details>
      <summary>Receipt Tracking</summary>
      <Stack>
        {#if result}
          <Card>
            <Inline gap="1.5rem" wrap="wrap">
              <span><strong>{result.received}</strong> / {result.checked} opened</span>
              {#if result.pending > 0}
                <span>{result.pending} pending</span>
              {/if}
            </Inline>
          </Card>
        {/if}

        <Inline>
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
