function normalizeWhitespace(markdown) {
  return markdown
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n[ \t]+\n/g, '\n\n')
    .trim();
}

function stripUnicodeDecoration(markdown) {
  return markdown
    .replace(/[\u2500-\u257F]/g, '')
    .replace(/[\u2766-\u2767\u2794-\u27BF]/g, '')
    .replace(/[★☆●○◆◇▶►▼▲■□▪▫◈◉✦✧✪✫✬✭✮✯✰]/g, '');
}

// Strip decorations first (may create blank lines), then normalize whitespace
export function postProcess(markdown) {
  return normalizeWhitespace(stripUnicodeDecoration(markdown));
}
