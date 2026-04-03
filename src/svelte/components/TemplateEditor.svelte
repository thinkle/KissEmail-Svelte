<script lang="ts">
  import {
    Bar,
    Button,
    Fieldset,
    Form,
    FormItem,
    Inline,
    Input,
    MiniButton,
    Option,
    Select,
    Stack,
    Toggle,
  } from "contain-css-svelte";
  import EmailFrame from "./EmailFrame.svelte";
  import TemplateWarnings from "./TemplateWarnings.svelte";
  import { renderPreview, type TemplateWarningReport } from "../lib/mailMerge";
  import type { SerializableCellValue } from "../../shared/mailMerge";
  import {
    FONT_OPTIONS,
    FONT_SIZE_OPTIONS,
    LINE_HEIGHT_OPTIONS,
  } from "../lib/emailDefaults";

  type TableBorderStyle = "transparent" | "dotted" | "solid";
  let {
    headers = [],
    templateHtml = $bindable(""),
    previewTemplateHtml = "",
    previewHtml = "",
    previewRows = [],
    previewRowNumbers = [],
    showOpenEditorButton = true,
    warningReport = {
      missingFields: [],
      suspiciousPlaceholders: [],
      notices: [],
    },
    mode = "sidebar",
    onOpenEditor,
    onSaveTemplate,
  }: {
    headers?: string[];
    templateHtml?: string;
    previewTemplateHtml?: string;
    previewHtml?: string;
    previewRows?: SerializableCellValue[][];
    previewRowNumbers?: number[];
    showOpenEditorButton?: boolean;
    warningReport?: TemplateWarningReport;
    mode?: "sidebar" | "editor";
    onOpenEditor?: () => void;
    onSaveTemplate?: () => void;
  } = $props();

  let previewOverride = $state<boolean | null>(null);
  let showSource = $state(false);
  let showTableTools = $state(false);
  let tableRows = $state(4);
  let tableColumns = $state(2);
  let tableHeaderRows = $state(1);
  let tableBorderStyle = $state<TableBorderStyle>("dotted");
  let tableFullWidth = $state(false);
  let showLinkTools = $state(false);
  let linkUrl = $state("");
  let linkText = $state("");
  let selectedPreviewRowIndex = $state(0);
  let editorEl = $state<HTMLDivElement | null>(null);
  let sourceEl = $state<HTMLTextAreaElement | null>(null);
  let activeTable = $state<HTMLTableElement | null>(null);
  let activeRow = $state<HTMLTableRowElement | null>(null);
  let savedRange = $state<Range | null>(null);
  let suspendSelectionCapture = $state(false);
  let linkSelectionRects = $state<
    Array<{ left: number; top: number; width: number; height: number }>
  >([]);

  const showPreview = $derived(previewOverride ?? mode === "sidebar");
  const normalizedPreviewRowIndex = $derived(
    previewRows[selectedPreviewRowIndex] ? selectedPreviewRowIndex : 0,
  );
  const previewRowOptions = $derived(
    previewRows.map((_, index) => ({
      value: String(index),
      label: `Row ${previewRowNumbers[index] ?? index + 1}`,
    })),
  );
  const effectivePreviewHtml = $derived(
    previewRows.length
      ? renderPreview(
          previewTemplateHtml || templateHtml,
          headers,
          previewRows[normalizedPreviewRowIndex] ?? previewRows[0] ?? [],
        )
      : previewHtml,
  );
  const hasActiveTable = $derived(Boolean(activeTable && activeRow));
  const activeRowIsHeading = $derived(
    Boolean(
      activeRow &&
        Array.from(activeRow.cells).length &&
        Array.from(activeRow.cells).every((cell) => cell.tagName === "TH"),
    ),
  );

  const DEFAULT_CELL_STYLE =
    "padding: 6px 8px; vertical-align: top; min-width: 3rem;";
  function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  function updateNumberState(
    setter: (value: number) => void,
    event: Event,
    min: number,
    max: number,
  ) {
    const input = event.currentTarget as HTMLInputElement;
    setter(clamp(Number(input.value) || min, min, max));
  }

  function getTableStyle(
    borderStyle: TableBorderStyle,
    fullWidth: boolean = tableFullWidth,
  ) {
    let cellBorder = "border: 1px dotted #cbd5e1;";
    if (borderStyle === "transparent") {
      cellBorder = "border: 1px solid transparent;";
    } else if (borderStyle === "solid") {
      cellBorder = "border: 1px solid #cbd5e1;";
    }

    return {
      table: `border-collapse: collapse; width: ${fullWidth ? "100%" : "auto"};`,
      cell: `${DEFAULT_CELL_STYLE} ${cellBorder}`,
      heading:
        `${DEFAULT_CELL_STYLE} ${cellBorder}` +
        " font-weight: 600; text-align: left;",
    };
  }

  function buildTableHtml() {
    const rows = clamp(tableRows, 1, 12);
    const columns = clamp(tableColumns, 1, 8);
    const headerRows = clamp(tableHeaderRows, 0, rows);
    const style = getTableStyle(tableBorderStyle);

    let html = `<table style="${style.table}">`;

    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      html += "<tr>";
      const isHeaderRow = rowIndex < headerRows;
      const tag = isHeaderRow ? "th" : "td";
      const cellStyle = isHeaderRow ? style.heading : style.cell;

      for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
        const label = isHeaderRow
          ? `Heading ${columnIndex + 1}`
          : `Cell ${rowIndex - headerRows + 1}-${columnIndex + 1}`;
        html += `<${tag} style="${cellStyle}">${label}</${tag}>`;
      }

      html += "</tr>";
    }

    html += "</table><p><br></p>";
    return html;
  }

  function moveCursorToCell(cell: HTMLTableCellElement | null) {
    if (!cell) {
      return;
    }
    const selection = window.getSelection();
    if (!selection) {
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(cell);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    updateTableSelection();
  }

  function logSelectionDebug(event: string, extra: Record<string, unknown> = {}) {
    const selection = window.getSelection();
    const anchor =
      selection?.anchorNode instanceof Element
        ? selection.anchorNode
        : selection?.anchorNode?.parentElement ?? null;
    console.log(
      "[TemplateEditor]",
      event,
      {
        hasSelection: Boolean(selection?.rangeCount),
        isCollapsed: selection?.isCollapsed ?? null,
        anchorText: anchor?.textContent?.slice(0, 40) ?? null,
        anchorTag: anchor?.tagName ?? null,
        savedRangeText: savedRange?.toString() ?? null,
        savedRangeCollapsed: savedRange?.collapsed ?? null,
        ...extra,
      },
    );
  }

  function clearLinkSelectionHighlight() {
    linkSelectionRects = [];
  }

  function updateLinkSelectionHighlight() {
    if (!editorEl || !savedRange || savedRange.collapsed) {
      clearLinkSelectionHighlight();
      return;
    }

    const editorRect = editorEl.getBoundingClientRect();
    linkSelectionRects = Array.from(savedRange.getClientRects())
      .map((rect) => ({
        left: rect.left - editorRect.left + editorEl.scrollLeft,
        top: rect.top - editorRect.top + editorEl.scrollTop,
        width: rect.width,
        height: rect.height,
      }))
      .filter((rect) => rect.width > 0 && rect.height > 0);
  }

  function restoreSelection() {
    const selection = window.getSelection();
    if (!selection || !savedRange) {
      logSelectionDebug("restoreSelection.skipped", {
        reason: !selection ? "no-selection" : "no-saved-range",
      });
      return;
    }

    selection.removeAllRanges();
    selection.addRange(savedRange.cloneRange());
    logSelectionDebug("restoreSelection.applied");
  }

  function updateTableSelection() {
    if (!editorEl) {
      activeTable = null;
      activeRow = null;
      return;
    }
    if (suspendSelectionCapture) {
      logSelectionDebug("updateTableSelection.suspended");
      return;
    }

    const selection = window.getSelection();
    if (!selection?.rangeCount) {
      activeTable = null;
      activeRow = null;
      return;
    }

    const anchor = selection.anchorNode;
    const element =
      anchor instanceof Element ? anchor : (anchor?.parentElement ?? null);

    if (!element || !editorEl.contains(element)) {
      activeTable = null;
      activeRow = null;
      return;
    }

    savedRange = selection.getRangeAt(0).cloneRange();
    logSelectionDebug("updateTableSelection.saved");
    activeTable = element.closest("table");
    activeRow = element.closest("tr");
    if (activeTable) {
      tableBorderStyle = getBorderStyleFromTable(activeTable);
      tableFullWidth = getTableWidthFromTable(activeTable);
    }
    if (showLinkTools) {
      updateLinkSelectionHighlight();
    }
  }

  function getBorderStyleFromTable(table: HTMLTableElement): TableBorderStyle {
    const cell = table.querySelector("th, td");
    const style = cell?.getAttribute("style") ?? "";

    if (style.includes("transparent")) {
      return "transparent";
    }
    if (style.includes("dotted")) {
      return "dotted";
    }
    return "solid";
  }

  function getTableWidthFromTable(table: HTMLTableElement): boolean {
    const style = table.getAttribute("style") ?? "";
    return style.includes("width: 100%");
  }

  function editable(node: HTMLDivElement, html: string) {
    if (node.innerHTML !== html) {
      node.innerHTML = html;
    }

    return {
      update(nextHtml: string) {
        if (node !== document.activeElement && node.innerHTML !== nextHtml) {
          node.innerHTML = nextHtml;
        }
      },
    };
  }

  function insertField(field: string) {
    if (!field) {
      return;
    }
    const token = `{{${field}}}`;
    if (showSource && sourceEl) {
      const start = sourceEl.selectionStart ?? sourceEl.value.length;
      const end = sourceEl.selectionEnd ?? sourceEl.value.length;
      templateHtml = `${templateHtml.slice(0, start)}${token}${templateHtml.slice(end)}`;
      return;
    }
    if (!editorEl) {
      return;
    }
    editorEl.focus();
    restoreSelection();
    try {
      document.execCommand("insertHTML", false, token);
    } catch {
      editorEl.innerHTML += token;
    }
    templateHtml = editorEl.innerHTML;
    updateTableSelection();
  }

  function toggleSource() {
    if (!showSource) {
      syncEditor();
      templateHtml = formatHtml(templateHtml);
    }
    showSource = !showSource;
  }

  function syncEditor() {
    if (!editorEl) {
      return;
    }
    templateHtml = editorEl.innerHTML;
    updateTableSelection();
  }

  function execEditorCommand(command: string) {
    if (!editorEl) {
      return;
    }
    editorEl.focus();
    restoreSelection();
    document.execCommand(command);
    syncEditor();
  }

  function replaceSelectionWithNode(node: HTMLElement) {
    const selection = window.getSelection();
    if (!selection?.rangeCount) {
      return false;
    }

    const range = selection.getRangeAt(0);
    const commonAncestor =
      range.commonAncestorContainer instanceof Element
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;

    if (!commonAncestor || !editorEl?.contains(commonAncestor)) {
      return false;
    }

    if (range.collapsed) {
      const textNode = document.createTextNode("\u200b");
      node.appendChild(textNode);
      range.insertNode(node);

      const nextRange = document.createRange();
      nextRange.setStart(textNode, 1);
      nextRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(nextRange);
      return true;
    }

    const fragment = range.extractContents();
    node.appendChild(fragment);
    range.insertNode(node);

    const nextRange = document.createRange();
    nextRange.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(nextRange);
    return true;
  }

  function applyInlineStyle(property: string, value: string) {
    if (!editorEl) {
      return;
    }

    editorEl.focus();
    restoreSelection();

    const span = document.createElement("span");
    if (value !== "default") {
      span.style.setProperty(property, value);
    }
    if (!replaceSelectionWithNode(span)) {
      return;
    }

    syncEditor();
  }

  function cleanupElement(node: HTMLElement) {
    if (node.tagName === "SPAN" && !node.getAttribute("style")) {
      node.replaceWith(...node.childNodes);
    }
  }

  function clearInlineStyle(property: string) {
    if (!editorEl) {
      return;
    }

    editorEl.focus();
    restoreSelection();

    const selection = window.getSelection();
    if (!selection?.rangeCount) {
      return;
    }

    const range = selection.getRangeAt(0);
    const commonAncestor =
      range.commonAncestorContainer instanceof Element
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;

    if (!commonAncestor || !editorEl.contains(commonAncestor)) {
      return;
    }

    if (range.collapsed) {
      let current: HTMLElement | null =
        commonAncestor instanceof HTMLElement
          ? commonAncestor
          : commonAncestor.parentElement;

      while (current && current !== editorEl) {
        if (current.style.getPropertyValue(property)) {
          current.style.removeProperty(property);
          cleanupElement(current);
          break;
        }
        current = current.parentElement;
      }

      syncEditor();
      return;
    }

    const elements = new Set<HTMLElement>();
    if (commonAncestor instanceof HTMLElement) {
      elements.add(commonAncestor);
    }

    const walker = document.createTreeWalker(
      commonAncestor,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode(node) {
          if (!(node instanceof HTMLElement)) {
            return NodeFilter.FILTER_SKIP;
          }
          return range.intersectsNode(node)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        },
      },
    );

    while (walker.nextNode()) {
      if (walker.currentNode instanceof HTMLElement) {
        elements.add(walker.currentNode);
      }
    }

    elements.forEach((element) => {
      if (element.style.getPropertyValue(property)) {
        element.style.removeProperty(property);
        cleanupElement(element);
      }
    });

    syncEditor();
  }

  function applyFontFamily(value: string) {
    if (!value) {
      return;
    }
    if (value === "default") {
      clearInlineStyle("font-family");
      return;
    }
    applyInlineStyle("font-family", value);
  }

  function applyFontSize(value: string) {
    if (!value) {
      return;
    }
    if (value === "default") {
      clearInlineStyle("font-size");
      return;
    }
    applyInlineStyle("font-size", value);
  }

  function applyLineHeight(value: string) {
    if (!value) {
      return;
    }
    if (value === "default") {
      clearInlineStyle("line-height");
      return;
    }
    applyInlineStyle("line-height", value);
  }

  function openLinkTools() {
    updateTableSelection();
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() ?? "";
    linkText = selectedText;
    if (!linkUrl) {
      linkUrl = "https://";
    }
    showLinkTools = true;
    updateLinkSelectionHighlight();
    logSelectionDebug("openLinkTools", { selectedText });
  }

  function applyLink() {
    if (!editorEl) {
      return;
    }

    suspendSelectionCapture = true;
    editorEl.focus();
    logSelectionDebug("applyLink.beforeRestore", {
      linkUrl,
      linkText,
    });
    restoreSelection();

    if (!linkUrl.trim()) {
      suspendSelectionCapture = false;
      logSelectionDebug("applyLink.aborted", { reason: "empty-url" });
      return;
    }

    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() ?? "";
    const trimmedUrl = linkUrl.trim();
    const trimmedText = linkText.trim();

    if (selectedText) {
      document.execCommand("createLink", false, trimmedUrl);
    } else {
      document.execCommand(
        "insertHTML",
        false,
        `<a href="${trimmedUrl}">${trimmedText || trimmedUrl}</a>`,
      );
    }

    showLinkTools = false;
    linkUrl = "";
    linkText = "";
    suspendSelectionCapture = false;
    clearLinkSelectionHighlight();
    syncEditor();
    logSelectionDebug("applyLink.complete");
  }

  function handleOpenLinkToolsMouseDown(event: MouseEvent) {
    event.preventDefault();
    logSelectionDebug("handleOpenLinkToolsMouseDown");
    openLinkTools();
  }

  function formatHtml(html: string) {
    return html
      .replace(/\r\n/g, "\n")
      .replace(/>\s+</g, "><")
      .replace(/(<br\s*\/?>)/gi, "$1\n")
      .replace(
        /(<\/?(?:p|div|h[1-6]|ul|ol|li|table|thead|tbody|tr|td|th|blockquote|section|article|header|footer|pre)\b[^>]*>)/gi,
        "\n$1",
      )
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function insertTable() {
    if (!editorEl) {
      return;
    }
    editorEl.focus();
    document.execCommand("insertHTML", false, buildTableHtml());
    templateHtml = editorEl.innerHTML;
    showTableTools = false;
    updateTableSelection();
  }

  function addRow() {
    if (!activeRow) {
      return;
    }

    const style = getTableStyle(tableBorderStyle);
    const newRow = document.createElement("tr");

    Array.from(activeRow.cells).forEach((cell, index) => {
      const tag = cell.tagName.toLowerCase();
      const nextCell = document.createElement(tag);
      nextCell.innerHTML = tag === "th" ? `Heading ${index + 1}` : "&nbsp;";
      nextCell.setAttribute(
        "style",
        cell.getAttribute("style") ||
          (tag === "th" ? style.heading : style.cell),
      );
      if (tag === "th") {
        nextCell.setAttribute("scope", "col");
      }
      newRow.appendChild(nextCell);
    });

    activeRow.after(newRow);
    syncEditor();
    moveCursorToCell(newRow.cells[0] as HTMLTableCellElement | null);
  }

  function addColumn() {
    if (!activeTable || !activeRow) {
      return;
    }

    const style = getTableStyle(tableBorderStyle);
    const currentRowIndex = activeRow.rowIndex;

    Array.from(activeTable.rows).forEach((row) => {
      const sampleCell = row.cells[row.cells.length - 1];
      const tag = sampleCell?.tagName.toLowerCase() ?? "td";
      const nextCell = document.createElement(tag);
      nextCell.innerHTML =
        tag === "th" ? `Heading ${row.cells.length + 1}` : "&nbsp;";
      nextCell.setAttribute(
        "style",
        sampleCell?.getAttribute("style") ||
          (tag === "th" ? style.heading : style.cell),
      );
      if (tag === "th") {
        nextCell.setAttribute("scope", "col");
      }
      row.appendChild(nextCell);
    });

    syncEditor();
    moveCursorToCell(
      activeTable.rows[currentRowIndex]?.cells[
        activeTable.rows[currentRowIndex].cells.length - 1
      ] as HTMLTableCellElement | null,
    );
  }

  function toggleHeadingRow() {
    if (!activeRow) {
      return;
    }

    const nextTag = activeRowIsHeading ? "td" : "th";
    const nextStyle = activeRowIsHeading
      ? getTableStyle(tableBorderStyle).cell
      : getTableStyle(tableBorderStyle).heading;

    Array.from(activeRow.cells).forEach((cell) => {
      const replacement = document.createElement(nextTag);
      Array.from(cell.attributes).forEach((attribute) => {
        if (attribute.name !== "scope") {
          replacement.setAttribute(attribute.name, attribute.value);
        }
      });
      replacement.setAttribute(
        "style",
        cell.getAttribute("style") || nextStyle,
      );
      if (nextTag === "th") {
        replacement.setAttribute("scope", "col");
      }
      replacement.innerHTML = cell.innerHTML;
      cell.replaceWith(replacement);
    });

    syncEditor();
  }

  function applyTableBorderStyle(borderStyle: TableBorderStyle) {
    if (!activeTable) {
      return;
    }

    const style = getTableStyle(borderStyle, tableFullWidth);
    activeTable.setAttribute("style", style.table);

    activeTable.querySelectorAll("th, td").forEach((cell) => {
      cell.setAttribute(
        "style",
        cell.tagName === "TH" ? style.heading : style.cell,
      );
    });

    tableBorderStyle = borderStyle;
    syncEditor();
  }

  function applyTableWidth(fullWidth: boolean) {
    if (!activeTable) {
      return;
    }

    const style = getTableStyle(tableBorderStyle, fullWidth);
    activeTable.setAttribute("style", style.table);
    tableFullWidth = fullWidth;
    syncEditor();
  }

  function handleFieldInsert(event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    insertField(String(select.value ?? ""));
    select.value = "";
  }

  function handleFontFamilyChange(event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    applyFontFamily(String(select.value ?? ""));
    select.value = "";
  }

  function handleFontSizeChange(event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    applyFontSize(String(select.value ?? ""));
    select.value = "";
  }

  function handleLineHeightChange(event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    applyLineHeight(String(select.value ?? ""));
    select.value = "";
  }
</script>

<Stack>
  <Bar>
    <Inline wrap="wrap" --inline-gap="16px">
      {#if mode === "sidebar"}
        {#if showOpenEditorButton}
          <Button onclick={onOpenEditor}>Edit Template</Button>
        {/if}
        <Toggle bind:checked={previewOverride}>
          {#snippet onLabel()}
            Preview
          {/snippet}
          {#snippet offLabel()}
            Template
          {/snippet}
        </Toggle>
      {:else}
        <Toggle bind:checked={previewOverride}>
          {#snippet onLabel()}
            Preview
          {/snippet}
          {#snippet offLabel()}
            Editor
          {/snippet}
        </Toggle>
        {#if !showPreview}
          <Toggle bind:checked={showSource}>
            {#snippet onLabel()}
              HTML
            {/snippet}
            {#snippet offLabel()}
              WYSIWYG
            {/snippet}
          </Toggle>
        {/if}
      {/if}
    </Inline>

    {#if mode === "editor"}
      <Button primary onclick={onSaveTemplate}>Save Template</Button>
    {/if}
  </Bar>

  {#if mode === "editor" && !showPreview}
    <Bar>
      {#if !showSource}
        <!-- Don't show edit buttons in HTML mode - power users
     can just write tags ;) -->
        <Inline wrap="wrap" align="center">
          <MiniButton
            onclick={() => execEditorCommand("bold")}
            aria-label="Bold"
          >
            <span class="toolbar-bold">B</span>
          </MiniButton>
          <MiniButton
            onclick={() => execEditorCommand("italic")}
            aria-label="Italic"
          >
            <span class="toolbar-italic">I</span>
          </MiniButton>
          <MiniButton
            onclick={() => execEditorCommand("underline")}
            aria-label="Underline"
          >
            <span class="toolbar-underline">U</span>
          </MiniButton>
          <MiniButton
            onclick={() => execEditorCommand("justifyLeft")}
            aria-label="Align left"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path
                d="M2 3h12v1H2zm0 3h8v1H2zm0 3h12v1H2zm0 3h8v1H2z"
                fill="currentColor"
              ></path>
            </svg>
          </MiniButton>
          <MiniButton
            onclick={() => execEditorCommand("justifyCenter")}
            aria-label="Align center"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path
                d="M2 3h12v1H2zm2 3h8v1H4zm0 3h8v1H4zm2 3h4v1H6z"
                fill="currentColor"
              ></path>
            </svg>
          </MiniButton>
          <MiniButton
            onclick={() => execEditorCommand("justifyRight")}
            aria-label="Align right"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path
                d="M2 3h12v1H2zm6 3h6v1H8zm0 3h6v1H8zm-4 3h10v1H4z"
                fill="currentColor"
              ></path>
            </svg>
          </MiniButton>
          <MiniButton
            onmousedown={handleOpenLinkToolsMouseDown}
            aria-label="Insert link"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path
                d="M6.5 10.5 5 12a2.12 2.12 0 0 1-3 0 2.12 2.12 0 0 1 0-3l2.5-2.5a2.12 2.12 0 0 1 3 0l.5.5-.88.88-.5-.5a.88.88 0 0 0-1.24 0L2.88 9.88a.88.88 0 0 0 0 1.24.88.88 0 0 0 1.24 0l1.5-1.5zm3-5L11 4a2.12 2.12 0 0 1 3 0 2.12 2.12 0 0 1 0 3l-2.5 2.5a2.12 2.12 0 0 1-3 0l-.5-.5.88-.88.5.5a.88.88 0 0 0 1.24 0l2.5-2.5a.88.88 0 0 0 0-1.24.88.88 0 0 0-1.24 0l-1.5 1.5zM5.75 8.88l4-4 .88.88-4 4z"
                fill="currentColor"
              ></path>
            </svg>
          </MiniButton>
          <Button onclick={() => (showTableTools = !showTableTools)}
            >Table</Button
          >

          <Select
            value=""
            onchange={handleFontFamilyChange}
            --select-width="70px"
          >
            <Option value="">Font</Option>
            {#each FONT_OPTIONS as option}
              <Option value={option.value}>
                <span style={option.previewStyle}>{option.label}</span>
              </Option>
            {/each}
          </Select>

          <Select value="" onchange={handleFontSizeChange}>
            <Option value="">Size</Option>
            {#each FONT_SIZE_OPTIONS as option}
              <Option value={option.value}>
                <span style={option.previewStyle}>{option.label}</span>
              </Option>
            {/each}
          </Select>

          <Select value="" onchange={handleLineHeightChange}>
            <Option value="">Line Height</Option>
            {#each LINE_HEIGHT_OPTIONS as option}
              <Option value={option.value}>
                <span style={option.previewStyle}>{option.label}</span>
              </Option>
            {/each}
          </Select>
        </Inline>
      {:else}
        <!--  Spacer -->
        <span>&nbsp;</span>
      {/if}
      <Select value="" onchange={handleFieldInsert}>
        <Option value="">Insert merge field...</Option>
        {#each headers as h}
          <Option value={h}>{h}</Option>
        {/each}
      </Select>
    </Bar>

    {#if showLinkTools}
      <Bar>
        <Inline wrap="wrap" align="end">
          <Input
            type="url"
            bind:value={linkUrl}
            placeholder="https://example.com"
          />
          <Input
            type="text"
            bind:value={linkText}
            placeholder="Link text (optional)"
          />
          <Button primary onclick={applyLink}>Apply Link</Button>
          <Button
            onclick={() => {
              showLinkTools = false;
              linkUrl = "";
              linkText = "";
              clearLinkSelectionHighlight();
            }}
          >
            Cancel
          </Button>
        </Inline>
      </Bar>
    {/if}
  {/if}

  {#if mode === "editor" && (showTableTools || hasActiveTable)}
    <Fieldset>
      {#snippet legend()}Table Tools{/snippet}

      <Stack>
        {#if showTableTools}
          <Form onsubmit={(e) => e.preventDefault()}>
            <FormItem>
              {#snippet label()}Rows{/snippet}
              <Input
                type="number"
                min="1"
                max="12"
                value={String(tableRows)}
                oninput={(event) =>
                  updateNumberState(
                    (value) => (tableRows = value),
                    event,
                    1,
                    12,
                  )}
              />
            </FormItem>

            <FormItem>
              {#snippet label()}Columns{/snippet}
              <Input
                type="number"
                min="1"
                max="8"
                value={String(tableColumns)}
                oninput={(event) =>
                  updateNumberState(
                    (value) => (tableColumns = value),
                    event,
                    1,
                    8,
                  )}
              />
            </FormItem>

            <FormItem>
              {#snippet label()}Header Rows{/snippet}
              <Input
                type="number"
                min="0"
                max="4"
                value={String(tableHeaderRows)}
                oninput={(event) =>
                  updateNumberState(
                    (value) => (tableHeaderRows = value),
                    event,
                    0,
                    4,
                  )}
              />
            </FormItem>

            <FormItem>
              {#snippet label()}Border{/snippet}
              <Select bind:value={tableBorderStyle}>
                <Option value="transparent">
                  <div style="padding:3px; margin: auto;">
                    Transparent
                  </div></Option
                >
                <Option value="dotted">
                  <div
                    style="padding:3px; border: 1px dotted #ccc; margin: auto;"
                  >
                    Dotted
                  </div></Option
                >
                <Option value="solid">
                  <div
                    style="padding:3px; border: 1px solid #ccc; margin: auto;"
                  >
                    Solid
                  </div></Option
                >
              </Select>
            </FormItem>

            <FormItem>
              {#snippet label()}Width{/snippet}
              <Inline>
                <Button
                  primary={!tableFullWidth}
                  onclick={() => (tableFullWidth = false)}
                >
                  Auto
                </Button>
                <Button
                  primary={tableFullWidth}
                  onclick={() => (tableFullWidth = true)}
                >
                  Full Width
                </Button>
              </Inline>
            </FormItem>
          </Form>

          <Inline wrap="wrap">
            <Button primary onclick={insertTable}>Insert Table</Button>
            <Button onclick={() => (showTableTools = false)}>Close</Button>
          </Inline>
        {/if}

        {#if hasActiveTable}
          <Inline wrap="wrap">
            <Button onclick={addRow}>+Row</Button>
            <Button onclick={addColumn}>+Column</Button>
            <Button onclick={toggleHeadingRow}>
              {activeRowIsHeading ? "Body" : "Heading"}
            </Button>
            <Button
              primary={!tableFullWidth}
              onclick={() => applyTableWidth(false)}
            >
              Auto
            </Button>
            <Button
              primary={tableFullWidth}
              onclick={() => applyTableWidth(true)}
            >
              Full Width
            </Button>
            <span>Border:</span>
            <Select
              value={tableBorderStyle}
              onchange={(event) =>
                applyTableBorderStyle(
                  (event.currentTarget as HTMLSelectElement)
                    .value as TableBorderStyle,
                )}
            >
              <Option value="transparent">
                <div style="padding:3px; margin: auto;">Transparent</div>
              </Option>
              <Option value="dotted">
                <div
                  style="padding:3px; border: 1px dotted #ccc; margin: auto;"
                >
                  Dotted
                </div>
              </Option>
              <Option value="solid">
                <div style="padding:3px; border: 1px solid #ccc; margin: auto;">
                  Solid
                </div>
              </Option>
            </Select>
          </Inline>
        {/if}
      </Stack>
    </Fieldset>
  {/if}
  <TemplateWarnings report={warningReport} />
  {#if showPreview}
    {#if previewRowOptions.length > 1}
      <Bar>
        <Inline align="center">
          <span>Preview Row</span>
          <Select
            value={String(normalizedPreviewRowIndex)}
            onchange={(event) =>
              (selectedPreviewRowIndex =
                Number((event.currentTarget as HTMLSelectElement).value) || 0)}
          >
            {#each previewRowOptions as option}
              <Option value={option.value}>{option.label}</Option>
            {/each}
          </Select>
        </Inline>
      </Bar>
    {/if}
    <div class="email-preview"><EmailFrame html={effectivePreviewHtml} /></div>
  {:else if showSource}
    <textarea class="source-view" bind:this={sourceEl} bind:value={templateHtml}
    ></textarea>
  {:else if mode === "editor"}
    <div class="editor-shell">
      <div
        class="editor"
        contenteditable="true"
        use:editable={templateHtml}
        bind:this={editorEl}
        onfocus={updateTableSelection}
        oninput={syncEditor}
        onkeyup={updateTableSelection}
        onmouseup={updateTableSelection}
        onscroll={updateLinkSelectionHighlight}
      ></div>
      {#if showLinkTools && linkSelectionRects.length}
        <div class="editor-selection-overlay" aria-hidden="true">
          {#each linkSelectionRects as rect}
            <div
              class="editor-selection-rect"
              style={`left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;`}
            ></div>
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    <div class="email-preview">
      <EmailFrame html={previewTemplateHtml || templateHtml} />
    </div>
  {/if}

  {#if mode === "sidebar"}
    Open the editor dialog to modify and save the HTML template.
  {/if}
</Stack>

<style>
  .editor-shell {
    position: relative;
  }

  .editor,
  .email-preview {
    border: 1px solid rgba(23, 48, 74, 0.14);
    border-radius: 16px;
    min-height: 260px;
    background: rgba(255, 255, 255, 0.92);
    overflow: auto;
  }

  .editor {
    padding: 14px;
    color: #1f2937;
    font-family: "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 14px;
    line-height: 1.45;
    --line-width: none;
    position: relative;
    z-index: 1;
  }

  .editor-selection-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 2;
  }

  .editor-selection-rect {
    position: absolute;
    background: color-mix(in srgb, #8ab4f8 55%, transparent);
    border-radius: 2px;
  }

  .editor :global(p),
  .editor :global(blockquote),
  .editor :global(dl),
  .editor :global(ul),
  .editor :global(ol),
  .editor :global(h1),
  .editor :global(h2),
  .editor :global(h3),
  .editor :global(h4),
  .editor :global(h5),
  .editor :global(h6) {
    max-width: none;
    margin-left: 0;
    margin-right: 0;
  }

  .editor :global(a) {
    color: -webkit-link;
    text-decoration: underline;
  }

  .editor :global(a:hover),
  .editor :global(a:focus-visible) {
    color: -webkit-link;
  }

  .source-view {
    border-radius: 16px;
    border: 1px solid rgba(23, 48, 74, 0.14);
    padding: 12px;
    min-height: 260px;
    width: 100%;
    box-sizing: border-box;
    font-family: "JetBrains Mono", "SFMono-Regular", ui-monospace, monospace;
    font-size: 12px;
  }

  .email-preview {
    background: #fffdf5;
    padding: 0;
    overflow: hidden;
  }

  .toolbar-bold {
    font-weight: 700;
  }

  .toolbar-italic {
    font-style: italic;
  }

  .toolbar-underline {
    text-decoration: underline;
  }
</style>
