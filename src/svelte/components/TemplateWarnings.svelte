<script lang="ts">
  import { Card } from "contain-css-svelte";
  import type { TemplateWarningReport } from "../lib/mailMerge";

  let {
    report = { missingFields: [], suspiciousPlaceholders: [], notices: [] },
    title = "Template warnings",
  }: {
    report?: TemplateWarningReport;
    title?: string;
  } = $props();

  function decodeForDisplay(value: string): string {
    return value
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&amp;/gi, "&");
  }
</script>

{#if report.missingFields.length || report.suspiciousPlaceholders.length || report.notices.length}
  <Card
    class="template-warnings"
    aria-label={title}
    --card-border="3px solid var(--warning-bg)"
  >
    <div class="warning-heading">
      <span class="warning-icon" aria-hidden="true">!</span>
      <strong>{title}</strong>
    </div>

    {#if report.missingFields.length}
      <div class="warning-group">
        <strong>Fields not found in this sheet</strong>
        <ul>
          {#each report.missingFields as field}
            <li><code>&#123;&#123;{field}&#125;&#125;</code></li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if report.suspiciousPlaceholders.length}
      <div class="warning-group">
        <strong>Possible placeholders that won’t merge</strong>
        <ul>
          {#each report.suspiciousPlaceholders as placeholder}
            <li>
              <code>{decodeForDisplay(placeholder.found)}</code>
              <span class="suggestion">
                should this be
                <code>&#123;&#123;{placeholder.suggestedField}&#125;&#125;</code>?
              </span>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if report.notices.length}
      <div class="warning-group">
        <strong>Other notes</strong>
        <ul>
          {#each report.notices as warning}
            <li>{warning}</li>
          {/each}
        </ul>
      </div>
    {/if}
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

  .warning-group + .warning-group {
    margin-top: 0.65rem;
  }

  .warning-group strong {
    display: block;
    margin-bottom: 0.35rem;
  }

  ul {
    margin: 0;
    padding-left: 1.25rem;
  }

  li + li {
    margin-top: 0.25rem;
  }

  .suggestion {
    margin-left: 0.35rem;
  }
</style>
