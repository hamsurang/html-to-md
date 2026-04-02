---
title: "Notion site rule: DOM-to-semantic-HTML translation for structure-preserving conversion"
category: integration-issues
date: 2026-04-02
tags: [notion, site-rule, dom-parsing, chrome-extension, html-to-markdown]
module: converter/site-rules
symptom: "Notion pages lose all document structure — headings become plain text, lists become inline bullets, title includes (N+) counter"
root_cause: "Notion renders all content as non-semantic div soup with CSS classes as the only semantic signal. Readability fallback cannot parse this structure."
---

# Notion Site Rule: DOM-to-Semantic-HTML Translation

## Problem

Notion pages converted via the html-to-md extension produced flat, unstructured text. Headings, lists, tables, code blocks, and other rich content all collapsed into plain paragraphs. The page title included Notion's notification counter `(9+)` and `| Notion` suffix.

**Example output before fix:**
```
# (9+) 함수랑산악회에 합류하세요 | Notion
\[함수랑산악회\] 1기 지원서 안녕하세요... 📋 이런 분과 함께 하고 싶어요 • 적극적이고 열정적인 분 • Giver의 마인드를 가진 분...
```

All structure was lost — headings, bullet lists, section dividers became one continuous text blob.

## Root Cause

Notion's DOM is entirely `<div>`-based. Block types are identified only by CSS classes like `notion-header-block`, `notion-text-block`, `notion-bulleted_list-block`. Unlike GitHub/SO/Medium which use semantic HTML (`<h1>`, `<ul>`, `<article>`), Notion has zero semantic tags.

The extension's `dom-cleaner.js` strips all `class`, `style`, and `data-*` attributes before Turndown converts to markdown. Without a site-specific extractor, the Readability fallback cannot identify content structure in Notion's div soup.

## Solution

Added a Notion site rule (`src/converter/site-rules/notion.js`) that translates Notion's div-based DOM into semantic HTML **before** it reaches the dom-cleaner. This is architecturally different from other site rules (which just scope to existing semantic HTML) — the Notion extractor is a full DOM-to-semantic-HTML translator.

### Key Design Decisions

1. **BLOCK_HANDLERS map pattern** — Dispatch table mapping `notion-{type}-block` CSS classes to handler functions. Extensible and testable.

2. **Single-pass traversal with list accumulator** — Walks `.notion-page-content` children once, grouping consecutive list items into `<ul>`/`<ol>` on the fly. O(n) guaranteed.

3. **`el.style` direct access, never `getComputedStyle`** — Notion uses inline `style` attributes for bold/italic/strikethrough. `getComputedStyle()` forces synchronous layout per call, causing 400-1000ms of layout thrashing on 500-block pages. `el.style` is O(1) with zero layout cost.

4. **Extractor returns `string|null`** — Kept the existing interface. Title cleaning happens in `content.js` rather than widening the return type to `{html, title}`, which would cause silent `[object Object]` failures if passed to `parseAndClean()`.

5. **`sanitizeTableHtml()` instead of `table.outerHTML`** — Raw `outerHTML` passthrough bypasses all escaping. Cell content is rebuilt with `escapeHtml()` to prevent XSS.

6. **URL scheme allowlist (`isSafeUrl`)** — Validates `http:`, `https:`, `mailto:` only. Blocks `javascript:`, `data:`, `vbscript:` URIs from embeds/bookmarks.

7. **Recursion depth limit (MAX_DEPTH=20)** — Prevents stack overflow from deeply nested or malicious DOM structures.

### Files Changed

| File | Change |
|------|--------|
| `src/converter/site-rules/notion.js` | New — full Notion extractor |
| `src/converter/site-rules/index.js` | Added notion to SITE_MAP, EXTRACTORS, matchHost; exported SITE_LABELS |
| `src/utils/html-escape.js` | New — shared escapeHtml/escapeAttr utilities |
| `src/content.js` | SITE_LABELS import, Notion title cleaning, window.__htmlToMdRunning guard |
| `src/utils/defaults.js` | Added notion: true |
| `src/utils/metadata.js` | Added optional customTitle parameter |
| `src/utils/post-process.js` | Narrowed Dingbats Unicode range to preserve callout emoji |
| `src/converter/site-rules/github.js` | Switched to shared escapeHtml import |

### Supported Block Types (18)

Text, h1/h2/h3, bulleted list, numbered list, to-do, quote, divider, code (with language), callout (with emoji), toggle (expanded), columns (flattened L-to-R), table, database table view, image, bookmark, embed/video.

## Prevention

- **When adding new site rules**: Check if the target site uses semantic HTML. If yes, scope to the container. If no (like Notion), build a DOM-to-semantic-HTML translator.
- **Never pass raw `outerHTML` from user-controlled DOM** — always sanitize cell-by-cell or run through `cleanDOM` first.
- **Never use `getComputedStyle` in content scripts** that process many elements — use `el.style` for inline styles.
- **Always validate URL schemes** when extracting URLs from third-party DOM — `escapeAttr` prevents attribute breakout but does not block `javascript:` URIs.
