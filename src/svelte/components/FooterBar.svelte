<script lang="ts">
  import { Button, Card, Inline, Tag } from "contain-css-svelte";

  let {
    ready = false,
    merging = false,
    onMerge,
  }: {
    ready?: boolean;
    merging?: boolean;
    onMerge: () => void;
  } = $props();
</script>

<Card>
  <Inline gap="0.75rem" wrap="wrap" align="center">
    <Button primary onclick={onMerge} disabled={!ready}>
      {merging ? "Merging..." : "Do Merge"}
    </Button>
    Template ready: {ready ? "yes" : "no"}
  </Inline>
</Card>
