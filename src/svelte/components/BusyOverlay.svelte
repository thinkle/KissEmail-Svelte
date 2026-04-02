<script lang="ts">
  import { Card, Progress, Stack } from "contain-css-svelte";

  let { busy = false, message = "" }: { busy?: boolean; message?: string } = $props();
</script>

{#if busy}
  <div class="busy-overlay">
    <div class="busy-card">
      <Card bg="rgba(255,255,255,0.97)">
        <Stack align="center">
          <Progress value={65} max={100} width="12rem" />
          <strong>{message || "Working..."}</strong>
        </Stack>
      </Card>
    </div>
  </div>
{/if}

<style>
  .busy-overlay {
    position: fixed;
    inset: 0;
    background: rgba(244, 247, 251, 0.76);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 25;
    backdrop-filter: blur(8px);
  }

  .busy-card {
    min-width: 260px;
    text-align: center;
  }
</style>
