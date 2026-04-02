const HTML_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
const ATTR_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };

export function escapeHtml(text) {
  return text.replace(/[&<>]/g, ch => HTML_ESC[ch]);
}

export function escapeAttr(text) {
  return text.replace(/[&<>"']/g, ch => ATTR_ESC[ch]);
}
