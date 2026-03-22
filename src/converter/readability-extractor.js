import { Readability } from '@mozilla/readability';

export function extractContent() {
  // Try subtree cloning first (article, main, [role="main"])
  const mainEl = document.querySelector('article, main, [role="main"]');
  let clone;

  if (mainEl) {
    // Wrap subtree in a minimal document-like structure
    clone = document.implementation.createHTMLDocument('');
    clone.body.appendChild(mainEl.cloneNode(true));
    // Copy title
    clone.title = document.title;
  } else {
    clone = document.cloneNode(true);
  }

  const article = new Readability(clone, {
    nbTopCandidates: 3,
    charThreshold: 1000,
    keepClasses: false,
  }).parse();

  return article;
}
