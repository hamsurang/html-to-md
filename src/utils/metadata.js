export function buildMetadata(customTitle) {
  const title = customTitle || document.title || 'Untitled';
  const url = window.location.href;
  return `# ${title}\n\nSource: ${url}\n\n`;
}
