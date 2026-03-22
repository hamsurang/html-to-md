import TurndownService from 'turndown';
import { tables } from 'turndown-plugin-gfm';

function createConverter(options = {}) {
  const {
    keepImages = true,
    keepLinks = true,
  } = options;

  const td = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
  });

  td.use(tables);

  // Elements not already stripped by dom-cleaner (which handles script/iframe/form/input etc.)
  td.remove([
    'style', 'nav', 'footer', 'aside',
    'svg', 'canvas', 'map', 'area',
    'form', 'label',
    'video', 'audio', 'source', 'track', 'picture',
    'dialog', 'menu', 'menuitem',
  ]);

  // Flatten h5/h6 to bold
  td.addRule('flattenDeepHeadings', {
    filter: ['h5', 'h6'],
    replacement(content) {
      return '\n\n**' + content.trim() + '**\n\n';
    },
  });

  // details/summary → bold heading + content
  td.addRule('detailsSummary', {
    filter: 'summary',
    replacement(content) {
      return '**' + content.trim() + '**\n\n';
    },
  });

  td.addRule('detailsExpand', {
    filter: 'details',
    replacement(content) {
      return '\n\n' + content.trim() + '\n\n';
    },
  });

  // Image handling
  td.addRule('optimizedImages', {
    filter: 'img',
    replacement(content, node) {
      const alt = (node.getAttribute('alt') || '').trim();
      const src = node.getAttribute('src') || '';

      // Strip tracking pixels and spacers
      if (
        src.includes('pixel') || src.includes('spacer') || src.includes('tracking') ||
        src.startsWith('data:image/gif') ||
        !alt || alt.toLowerCase() === 'image'
      ) {
        return alt ? `[Image: ${alt}]` : '';
      }

      if (!keepImages) {
        return alt.length > 2 ? `[Image: ${alt}]` : '';
      }

      return src ? `![${alt}](${src})` : (alt ? `[Image: ${alt}]` : '');
    },
  });

  // Link handling
  td.addRule('optimizedLinks', {
    filter(node) {
      return node.nodeName === 'A' && node.getAttribute('href');
    },
    replacement(content, node) {
      const text = content.trim();
      if (!text) return '';

      const href = node.getAttribute('href') || '';
      if (href.startsWith('#') || href.startsWith('javascript:')) return text;

      if (!keepLinks) return text;

      // Skip if text === URL (dedup)
      if (text === href || text === href.replace(/^https?:\/\//, '')) return text;

      return `[${text}](${href})`;
    },
  });

  // Collapse BR chains
  td.addRule('brHandler', {
    filter: 'br',
    replacement(content, node) {
      const next = node.nextSibling;
      if (next && next.nodeName === 'BR') return '';
      return '\n';
    },
  });

  // Remove empty elements
  td.addRule('removeEmpty', {
    filter(node) {
      return (
        node.textContent.trim() === '' &&
        !['IMG', 'BR', 'HR', 'TD', 'TH', 'TABLE'].includes(node.nodeName) &&
        !node.querySelector('img')
      );
    },
    replacement() {
      return '';
    },
  });

  // Unwrap non-semantic wrappers
  td.addRule('unwrapWrappers', {
    filter(node) {
      return ['DIV', 'SPAN', 'SECTION', 'ARTICLE', 'MAIN', 'FIGURE', 'FIGCAPTION'].includes(node.nodeName);
    },
    replacement(content) {
      return content;
    },
  });

  return td;
}

export function convertToMarkdown(html, options = {}) {
  const converter = createConverter(options);
  return converter.turndown(html);
}
