<script lang="ts">
  import { Button, Card, Inline, Progress, Stack } from "contain-css-svelte";

  let {
    ready = false,
    merging = false,
    disabled = false,
    onMerge,
  }: {
    ready?: boolean;
    merging?: boolean;
    disabled?: boolean;
    onMerge: () => void;
  } = $props();
</script>

<Card>
  <Stack>
    <Inline gap="0.75rem" wrap="wrap" align="center">
      <Button danger onclick={onMerge} disabled={!ready || disabled}>
        {merging ? "Merging..." : "Do Merge"}
      </Button>
      Template ready: {ready ? "yes" : "no"}
    </Inline>
    {#if merging}
      <Stack>
        <Progress value={65} max={100} width="12rem" />
        <p>
          Sending mail merge. This can take a while for large sends. You can
          close the sidebar and the merge will continue in the background. If it
          times out before finishing, reopen the sidebar and click Do Merge
          again to resume.
        </p>
      </Stack>
    {/if}
  </Stack>
</Card>
