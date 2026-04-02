/**
 * Notion site rule extractor.
 *
 * Unlike other extractors that scope into existing semantic HTML,
 * this extractor translates Notion's div-based DOM into semantic HTML.
 * The output MUST be fully semantic (h1, p, ul, ol, blockquote, pre, table, hr, etc.)
 * because parseAndClean() strips all class/style/data-* attributes downstream.
 */

import { escapeHtml, escapeAttr } from '../../utils/html-escape.js';


const BLOCK_HANDLERS = {
  'notion-header-block':         (el) => `<h1>${getInlineHTML(el)}</h1>`,
  'notion-sub_header-block':     (el) => `<h2>${getInlineHTML(el)}</h2>`,
  'notion-sub_sub_header-block': (el) => `<h3>${getInlineHTML(el)}</h3>`,
  'notion-text-block':           (el) => `<p>${getInlineHTML(el)}</p>`,
  'notion-divider-block':        ()   => '<hr>',
  'notion-quote-block':          (el) => `<blockquote>${getInlineHTML(el)}</blockquote>`,
  'notion-callout-block':        extractCallout,
  'notion-code-block':           extractCode,
  'notion-toggle-block':         extractToggle,
  'notion-column_list-block':    extractColumns,
  'notion-table-block':          extractTable,
  'notion-collection_view-block': extractCollectionView,
  'notion-image-block':          extractImage,
  'notion-bookmark-block':       extractBookmark,
  'notion-embed-block':          extractEmbed,
  'notion-video-block':          extractEmbed,
  'notion-to_do-block':          null, // handled by list grouping
  'notion-bulleted_list-block':  null, // handled by list grouping
  'notion-numbered_list-block':  null, // handled by list grouping
};


export function extractNotion() {
  const root = document.querySelector('.notion-page-content');
  if (!root) return null;

  const html = convertChildren(root);
  return html || null;
}


function getListTag(type) {
  if (type === 'notion-bulleted_list-block' || type === 'notion-to_do-block') return 'ul';
  if (type === 'notion-numbered_list-block') return 'ol';
  return null;
}

function convertChildren(container) {
  const children = container.children;
  if (!children || children.length === 0) return '';

  const parts = [];
  let listItems = [];
  let listTag = null;

  for (const child of children) {
    const type = identifyBlockType(child);
    const childListTag = getListTag(type);

    if (childListTag && childListTag === listTag) {
      listItems.push(convertListItem(child, type));
    } else {
      if (listItems.length > 0) {
        parts.push(`<${listTag}>${listItems.join('')}</${listTag}>`);
        listItems = [];
        listTag = null;
      }

      if (childListTag) {
        listTag = childListTag;
        listItems.push(convertListItem(child, type));
      } else if (type) {
        const handler = BLOCK_HANDLERS[type];
        if (handler) {
          const result = handler(child);
          if (result) parts.push(result);
        }
      } else {
        // Unknown block — textContent fallback
        const text = child.textContent.trim();
        if (text) parts.push(`<p>${escapeHtml(text)}</p>`);
      }
    }
  }

  // Flush remaining list
  if (listItems.length > 0) {
    parts.push(`<${listTag}>${listItems.join('')}</${listTag}>`);
  }

  return parts.join('\n');
}


const BLOCK_TYPES = new Set(Object.keys(BLOCK_HANDLERS));

function identifyBlockType(el) {
  const cl = el.classList;
  if (!cl) return null;
  for (const className of cl) {
    if (BLOCK_TYPES.has(className)) return className;
  }
  return null;
}


function convertListItem(el, type) {
  const isTodo = type === 'notion-to_do-block';
  let prefix = '';
  if (isTodo) {
    const checkbox = el.querySelector('[role="checkbox"], input[type="checkbox"]');
    const checked = checkbox
      ? (checkbox.getAttribute('aria-checked') === 'true' || checkbox.checked)
      : false;
    prefix = checked ? '[x] ' : '[ ] ';
  }

  const text = getInlineHTML(el);

  // Recurse into nested blocks (children within this list item)
  const nested = convertNestedBlocks(el);

  return `<li>${prefix}${text}${nested}</li>`;
}

function convertNestedBlocks(parentBlock) {
  // Fast bail-out: leaf items with no/single child don't have nested blocks
  if (!parentBlock.children || parentBlock.children.length <= 1) return '';

  // Iterate direct children and filter by block type (avoids CSS selector engine)
  const nestedBlocks = [];
  for (const child of parentBlock.children) {
    if (child !== parentBlock.firstElementChild && identifyBlockType(child)) {
      nestedBlocks.push(child);
    }
  }
  if (nestedBlocks.length === 0) return '';

  // Build a temporary container with only actual nested block children
  const nestedParts = [];
  let nestedListItems = [];
  let nestedListTag = null;

  for (const child of nestedBlocks) {
    const type = identifyBlockType(child);
    if (!type) continue;

    const childListTag = getListTag(type);

    if (childListTag) {
      if (childListTag === nestedListTag) {
        nestedListItems.push(convertListItem(child, type));
      } else {
        if (nestedListItems.length > 0) {
          nestedParts.push(`<${nestedListTag}>${nestedListItems.join('')}</${nestedListTag}>`);
        }
        nestedListTag = childListTag;
        nestedListItems = [convertListItem(child, type)];
      }
    } else {
      if (nestedListItems.length > 0) {
        nestedParts.push(`<${nestedListTag}>${nestedListItems.join('')}</${nestedListTag}>`);
        nestedListItems = [];
        nestedListTag = null;
      }
      const handler = BLOCK_HANDLERS[type];
      if (handler) {
        const result = handler(child);
        if (result) nestedParts.push(result);
      }
    }
  }

  if (nestedListItems.length > 0) {
    nestedParts.push(`<${nestedListTag}>${nestedListItems.join('')}</${nestedListTag}>`);
  }

  return nestedParts.length > 0 ? '\n' + nestedParts.join('\n') : '';
}


function getInlineHTML(block) {
  // Find the text content area — skip non-text children like toggle arrows, icons
  const contentEl = block.querySelector('[contenteditable], [data-content-editable-leaf]')
    || block.querySelector('.notion-enable-hover')
    || block;

  return processInlineChildren(contentEl);
}

function processInlineChildren(el, depth = 0) {
  if (depth > MAX_DEPTH) return escapeHtml(el.textContent);

  const parts = [];

  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(escapeHtml(node.textContent));
      continue;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    const tag = node.tagName.toLowerCase();

    // Preserve existing semantic tags
    if (tag === 'a') {
      const href = node.getAttribute('href');
      if (href && href !== '#' && isSafeUrl(href)) {
        parts.push(`<a href="${escapeAttr(href)}">${processInlineChildren(node, depth + 1)}</a>`);
      } else {
        parts.push(processInlineChildren(node, depth + 1));
      }
      continue;
    }

    if (tag === 'code') {
      parts.push(`<code>${escapeHtml(node.textContent)}</code>`);
      continue;
    }

    if (tag === 'br') {
      parts.push('<br>');
      continue;
    }

    // Handle semantic tags first (avoid double wrapping with style checks)
    if (tag === 'b' || tag === 'strong') {
      parts.push(`<strong>${processInlineChildren(node, depth + 1)}</strong>`);
      continue;
    }
    if (tag === 'i' || tag === 'em') {
      parts.push(`<em>${processInlineChildren(node, depth + 1)}</em>`);
      continue;
    }

    // For spans and other elements, check inline styles
    let inner = processInlineChildren(node, depth + 1);
    if (!inner.trim()) continue;

    const s = node.style;
    if (s) {
      if (s.fontWeight === '600' || s.fontWeight === '700' || s.fontWeight === 'bold') {
        inner = `<strong>${inner}</strong>`;
      }
      if (s.fontStyle === 'italic') {
        inner = `<em>${inner}</em>`;
      }
      if (s.textDecoration && s.textDecoration.includes('line-through')) {
        inner = `<s>${inner}</s>`;
      }
    }

    parts.push(inner);
  }

  return parts.join('');
}


function extractCallout(el) {
  const iconEl = el.querySelector('.notion-record-icon, [class*="icon"]');
  const icon = iconEl ? escapeHtml(iconEl.textContent.trim()) : '';

  // Temporarily remove icon element to avoid including it in inline HTML
  if (iconEl && iconEl.parentNode) {
    iconEl.parentNode.removeChild(iconEl);
  }
  const text = getInlineHTML(el);
  // Restore icon element to avoid mutating the live DOM permanently
  if (iconEl && el.contains(el.firstElementChild)) {
    el.insertBefore(iconEl, el.firstElementChild);
  }

  return `<blockquote>${icon ? icon + ' ' : ''}${text}</blockquote>`;
}

function extractCode(el) {
  const codeEl = el.querySelector('code');
  const code = codeEl ? codeEl.textContent : el.textContent.trim();

  // Language label is typically in a small button/selector element
  const langEl = el.querySelector('[class*="language"], [role="button"]');
  let lang = '';
  if (langEl) {
    const langText = langEl.textContent.trim().toLowerCase();
    // Filter out common non-language labels
    if (langText && langText !== 'copy' && langText.length < 30) {
      lang = langText;
    }
  }

  return `<pre><code${lang ? ` class="language-${escapeAttr(lang)}"` : ''}>${escapeHtml(code)}</code></pre>`;
}

function extractToggle(el) {
  // First meaningful text is the toggle title
  const firstChild = el.firstElementChild;
  const title = firstChild ? firstChild.textContent.trim() : '';

  // Check if title should be a heading (if the toggle itself has heading-like styling)
  const titleHtml = title ? `<p><strong>${escapeHtml(title)}</strong></p>` : '';

  // Expand children (all nested blocks within the toggle)
  const nested = convertNestedBlocks(el);

  return titleHtml + nested;
}

function extractColumns(el) {
  const columns = el.querySelectorAll('[class*="notion-column-block"]');
  if (columns.length === 0) return convertChildren(el);

  // Flatten left-to-right
  const parts = [];
  for (const col of columns) {
    const html = convertChildren(col);
    if (html) parts.push(html);
  }
  return parts.join('\n');
}

function extractTable(el) {
  const table = el.querySelector('table');
  if (table) return sanitizeTableHtml(table);

  // Fallback: try to build table from div-based structure
  return extractDivTable(el);
}

function extractCollectionView(el) {
  // Only support table view
  const table = el.querySelector('table');
  if (table) return sanitizeTableHtml(table);

  // Try div-based table view
  const headerCells = el.querySelectorAll('[class*="table-view-header-cell"], [class*="collection-header"]');
  if (headerCells.length === 0) {
    // Not a table view or unrecognizable — fallback
    const text = el.textContent.trim();
    return text ? `<p>${escapeHtml(text)}</p>` : '';
  }

  return extractDivTable(el);
}

function extractDivTable(container) {
  // Attempt to extract header + rows from div-based table
  const rows = container.querySelectorAll('[class*="collection-item"], [class*="table-row"]');
  if (rows.length === 0) {
    const text = container.textContent.trim();
    return text ? `<p>${escapeHtml(text)}</p>` : '';
  }

  const tableRows = [];
  for (const row of rows) {
    const cells = row.querySelectorAll('[class*="cell"]');
    if (cells.length > 0) {
      const tag = tableRows.length === 0 ? 'th' : 'td';
      const cellsHtml = Array.from(cells)
        .map(c => `<${tag}>${escapeHtml(c.textContent.trim())}</${tag}>`)
        .join('');
      tableRows.push(`<tr>${cellsHtml}</tr>`);
    }
  }

  if (tableRows.length === 0) {
    const text = container.textContent.trim();
    return text ? `<p>${escapeHtml(text)}</p>` : '';
  }

  return `<table>${tableRows.join('')}</table>`;
}

function extractImage(el) {
  const img = el.querySelector('img');
  if (!img) return '';

  const src = img.src || img.getAttribute('data-src') || '';
  if (!src || !isSafeUrl(src)) return '';

  const alt = img.alt || '';
  return `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}">`;
}

function extractBookmark(el) {
  const link = el.querySelector('a[href]');
  if (link) {
    const href = link.getAttribute('href');
    if (href && isSafeUrl(href)) {
      const title = link.textContent.trim() || el.textContent.trim() || href;
      return `<p><a href="${escapeAttr(href)}">${escapeHtml(title)}</a></p>`;
    }
  }

  // Fallback: look for any URL-like text
  const text = el.textContent.trim();
  return text ? `<p>${escapeHtml(text)}</p>` : '';
}

function extractEmbed(el) {
  // Extract URL from iframe before dom-cleaner removes it
  const iframe = el.querySelector('iframe');
  if (iframe) {
    const src = iframe.src || iframe.getAttribute('data-src') || '';
    if (src && isSafeUrl(src)) {
      return `<p><a href="${escapeAttr(src)}">${escapeHtml(src)}</a></p>`;
    }
  }

  // Fallback: check for a link
  const link = el.querySelector('a[href]');
  if (link) {
    const href = link.getAttribute('href');
    if (href && isSafeUrl(href)) {
      return `<p><a href="${escapeAttr(href)}">${escapeHtml(link.textContent.trim() || href)}</a></p>`;
    }
  }

  const text = el.textContent.trim();
  return text ? `<p>${escapeHtml(text)}</p>` : '';
}


const MAX_DEPTH = 20;

function isSafeUrl(url) {
  if (/^(https?:|mailto:)/i.test(url)) return true;
  if (/^(javascript|data|vbscript|blob):/i.test(url)) return false;
  try {
    const u = new URL(url, 'https://placeholder');
    return ['http:', 'https:', 'mailto:'].includes(u.protocol);
  } catch {
    return false;
  }
}


function sanitizeTableHtml(tableEl) {
  const rows = tableEl.querySelectorAll('tr');
  if (rows.length === 0) return '';

  const tableRows = [];
  for (const row of rows) {
    const cells = row.querySelectorAll('th, td');
    if (cells.length === 0) continue;
    const isHeader = tableRows.length === 0 && cells[0].tagName === 'TH';
    const tag = isHeader ? 'th' : 'td';
    const cellsHtml = Array.from(cells)
      .map(c => `<${tag}>${escapeHtml(c.textContent.trim())}</${tag}>`)
      .join('');
    tableRows.push(`<tr>${cellsHtml}</tr>`);
  }

  return tableRows.length > 0 ? `<table>${tableRows.join('')}</table>` : '';
}
