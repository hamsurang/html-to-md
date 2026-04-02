import { escapeHtml } from '../../utils/html-escape.js';

export function extractGitHub() {
  const path = window.location.pathname;

  // Code blob (/blob/ URLs)
  if (path.includes('/blob/')) {
    return extractCodeBlob();
  }

  // Issue or PR page
  if (path.match(/\/(issues|pull)\/\d+/)) {
    return extractIssuePR();
  }

  // README or file view
  const readme = document.querySelector('article.markdown-body, .readme .markdown-body');
  if (readme) {
    return readme.outerHTML;
  }

  // Release notes
  const release = document.querySelector('.release .markdown-body');
  if (release) {
    return release.outerHTML;
  }

  return null;
}

const LANG_MAP = {
  js: 'javascript', ts: 'typescript', py: 'python', rb: 'ruby',
  go: 'go', rs: 'rust', java: 'java', cpp: 'cpp', c: 'c',
  sh: 'bash', yml: 'yaml', yaml: 'yaml', json: 'json',
  md: 'markdown', html: 'html', css: 'css', sql: 'sql',
  jsx: 'jsx', tsx: 'tsx', swift: 'swift', kt: 'kotlin',
};

function extractCodeBlob() {
  const codeEl = document.querySelector('.blob-wrapper .highlight, .react-code-lines');
  if (!codeEl) return null;

  const path = window.location.pathname;
  const ext = path.split('.').pop();
  const lang = LANG_MAP[ext] || ext || '';

  const lines = codeEl.querySelectorAll('[data-line-number]');
  let code = '';
  if (lines.length > 0) {
    code = Array.from(lines).map(el => {
      const codeLine = el.closest('tr')?.querySelector('td:last-child');
      return codeLine ? codeLine.textContent : '';
    }).join('\n');
  } else {
    code = codeEl.textContent;
  }

  return `<pre><code class="language-${lang}">${escapeHtml(code)}</code></pre>`;
}

function extractIssuePR() {
  const parts = [];

  // Title
  const titleEl = document.querySelector('.js-issue-title, .gh-header-title .markdown-title');
  if (titleEl) {
    parts.push(`<h1>${titleEl.textContent.trim()}</h1>`);
  }

  // Description (first comment)
  const description = document.querySelector('.js-comment-body .markdown-body');
  if (description) {
    parts.push(description.outerHTML);
  }

  // Comments in timeline
  const comments = document.querySelectorAll('.timeline-comment');
  for (const comment of comments) {
    const authorEl = comment.querySelector('.author');
    const bodyEl = comment.querySelector('.comment-body .markdown-body, .js-comment-body');
    if (bodyEl && authorEl) {
      const author = authorEl.textContent.trim();
      parts.push(`<h3>@${author}</h3>`);
      parts.push(bodyEl.outerHTML);
      parts.push('<hr>');
    }
  }

  return parts.length > 0 ? parts.join('\n') : null;
}

