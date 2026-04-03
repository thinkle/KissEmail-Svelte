<script lang="ts">
  import { Card } from "contain-css-svelte";

  let {
    warnings = [],
    title = "Template warnings",
  }: {
    warnings?: string[];
    title?: string;
  } = $props();
</script>

{#if warnings.length}
  <Card
    class="template-warnings"
    aria-label={title}
    --card-border="3px solid var(--warning-bg)"
  >
    <div class="warning-heading">
      <span class="warning-icon" aria-hidden="true">!</span>
      <strong>{title}</strong>
    </div>
    <ul>
      {#each warnings as warning}
        <li>{warning}</li>
      {/each}
    </ul>
  </Card>
{/if}

<style>
  .warning-heading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    color: var(--warning-bg);
  }

  .warning-icon {
    display: inline-grid;
    place-items: center;
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 999px;
    background: var(--warning-bg, #6b4e00);
    color: var(--warning-fg, white);
    font-size: 0.8rem;
    line-height: 1;
  }

  ul {
    margin: 0;
    padding-left: 1.25rem;
  }

  li + li {
    margin-top: 0.25rem;
  }
</style>
