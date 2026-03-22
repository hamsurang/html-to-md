// Single selector for all elements to remove (14 queries → 1)
const REMOVE_SELECTOR = [
  'base', 'script', 'iframe', 'object', 'embed', 'noscript',
  'input', 'select', 'textarea', 'button', '[type="hidden"]',
].join(',');

export function cleanDOM(root) {
  root.querySelectorAll(REMOVE_SELECTOR).forEach(el => el.remove());

  root.querySelectorAll('details').forEach(el => el.setAttribute('open', ''));

  root.querySelectorAll('a[href]').forEach(el => {
    if (el.href) el.setAttribute('href', el.href);
  });
  root.querySelectorAll('img[src]').forEach(el => {
    if (el.src) el.setAttribute('src', el.src);
  });

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  while (walker.nextNode()) {
    const el = walker.currentNode;
    const toRemove = [];
    for (const attr of el.attributes) {
      const name = attr.name;
      if (
        name === 'class' || name === 'style' || name === 'id' ||
        name === 'role' || name === 'tabindex' ||
        name.startsWith('data-') ||
        name.startsWith('aria-') ||
        name.startsWith('on')
      ) {
        toRemove.push(name);
      }
    }
    toRemove.forEach(name => el.removeAttribute(name));
  }

  return root;
}

// Higher-level helper: parse HTML string → clean → return DOM node
export function parseAndClean(htmlString) {
  const doc = new DOMParser().parseFromString(htmlString, 'text/html');
  cleanDOM(doc.body);
  return doc.body;
}
