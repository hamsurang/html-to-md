export function extractMediumSubstack() {
  // Medium
  const mediumArticle = document.querySelector('article');
  if (mediumArticle) {
    return mediumArticle.outerHTML;
  }

  // Substack
  const substackContent = document.querySelector('.available-content, .body.markup, .post-content');
  if (substackContent) {
    return substackContent.outerHTML;
  }

  return null;
}
