<script lang="ts">
  import {
    DEFAULT_EMAIL_FONT_SIZE,
    DEFAULT_EMAIL_FONT_STACK,
    DEFAULT_EMAIL_LINE_HEIGHT,
    DEFAULT_EMAIL_PADDING,
    DEFAULT_EMAIL_TEXT_COLOR,
  } from "../lib/emailDefaults";

  let {
    html = "",
    title = "Email preview",
  }: {
    html?: string;
    title?: string;
  } = $props();

  let iframeEl = $state<HTMLIFrameElement | null>(null);
  let frameHeight = $state(320);
  let resizeObserver = $state<ResizeObserver | null>(null);

  const srcdoc = $derived.by(() => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: white;
      }

      body {
        min-height: 100%;
        padding: ${DEFAULT_EMAIL_PADDING};
        box-sizing: border-box;
        color: ${DEFAULT_EMAIL_TEXT_COLOR};
        font-family: ${DEFAULT_EMAIL_FONT_STACK};
        font-size: ${DEFAULT_EMAIL_FONT_SIZE};
        line-height: ${DEFAULT_EMAIL_LINE_HEIGHT};
      }

      img {
        max-width: 100%;
        height: auto;
      }

      table {
        max-width: 100%;
      }
    </style>
  </head>
  <body>${html}</body>
</html>`);

  function disconnectObserver() {
    resizeObserver?.disconnect();
    resizeObserver = null;
  }

  function updateHeight() {
    const doc = iframeEl?.contentDocument;
    if (!doc) {
      return;
    }

    const nextHeight = Math.max(
      doc.documentElement?.scrollHeight ?? 0,
      doc.body?.scrollHeight ?? 0,
      320,
    );
    frameHeight = nextHeight;
  }

  function handleLoad() {
    disconnectObserver();
    updateHeight();

    const doc = iframeEl?.contentDocument;
    const observedNode = doc?.body;
    if (!observedNode) {
      return;
    }

    resizeObserver = new ResizeObserver(() => updateHeight());
    resizeObserver.observe(observedNode);
  }
</script>

<iframe
  bind:this={iframeEl}
  class="email-frame"
  {title}
  {srcdoc}
  sandbox="allow-same-origin"
  style:height={`${frameHeight}px`}
  onload={handleLoad}
></iframe>

<style>
  .email-frame {
    display: block;
    width: 100%;
    border: 0;
    background: white;
    border-radius: inherit;
  }
</style>
