export function buildMetadata() {
  const title = document.title || 'Untitled';
  const url = window.location.href;
  return `# ${title}\n\nSource: ${url}\n\n`;
}
