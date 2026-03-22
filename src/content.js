import { extractContent } from './converter/readability-extractor.js';
import { cleanDOM, parseAndClean } from './converter/dom-cleaner.js';
import { convertToMarkdown } from './converter/turndown-converter.js';
import { postProcess } from './utils/post-process.js';
import { buildMetadata } from './utils/metadata.js';
import { writeToClipboard } from './utils/clipboard.js';
import { showToast } from './utils/toast.js';
import { detectSite, extractSiteContent } from './converter/site-rules/index.js';
import { DEFAULT_SETTINGS } from './utils/defaults.js';
import { PRESET_SELECTORS } from './utils/presets.js';

;(() => {
  let running = false;

  async function convert() {
    if (running) return;
    running = true;
    try {
      if (document.readyState === 'loading') {
        await new Promise(resolve =>
          document.addEventListener('DOMContentLoaded', resolve, { once: true })
        );
      }

      const settings = window.__htmlToMdSettings || DEFAULT_SETTINGS;
      const converterOptions = {
        keepImages: settings.keepImages,
        keepLinks: settings.keepLinks,
      };

      let contentNode = null;
      let usedFallback = false;
      let siteMode = null;

      // 1. Site-specific rules (if enabled)
      const site = detectSite();
      if (site && settings.siteRules?.[site] !== false) {
        const raw = extractSiteContent(site);
        if (raw) {
          contentNode = parseAndClean(raw);
          const SITE_LABELS = { github: 'GitHub', stackoverflow: 'Stack Overflow', medium: 'Medium', substack: 'Substack' };
          siteMode = SITE_LABELS[site] || site;
        }
      }

      // 2. Readability fallback
      if (!contentNode) {
        const article = extractContent();
        if (article && article.content) {
          contentNode = parseAndClean(article.content);
        }
      }

      // 3. document.body fallback
      if (!contentNode) {
        usedFallback = true;
        const clone = document.body.cloneNode(true);
        cleanDOM(clone);
        contentNode = clone;
      }

      // Apply enabled preset selectors
      const enabledPresets = settings.enabledPresets || {};
      for (const [idx, enabled] of Object.entries(enabledPresets)) {
        if (!enabled) continue;
        const preset = PRESET_SELECTORS[idx];
        if (!preset) continue;
        try { contentNode.querySelectorAll(preset.selector).forEach(el => el.remove()); } catch {}
      }

      // Apply custom selectors to remove noise
      const currentDomain = window.location.hostname;
      const customSelectors = settings.customSelectors || {};
      const allSelectors = [
        ...(customSelectors['*'] || []),
        ...(customSelectors[currentDomain] || []),
      ];
      for (const sel of allSelectors) {
        try { contentNode.querySelectorAll(sel).forEach(el => el.remove()); } catch {}
      }

      // 4. Convert DOM node directly to Markdown (no double serialization)
      let markdown = convertToMarkdown(contentNode, converterOptions);

      // 5. Post-process
      markdown = postProcess(markdown);

      // 6. Prepend metadata
      if (settings.includeMetadata) {
        markdown = buildMetadata() + markdown;
      }

      // 7. Check for empty result
      const contentOnly = markdown.replace(/^#[^\n]*\n\nSource:[^\n]*\n\n/, '').trim();
      if (!contentOnly) {
        showToast('No content found on this page', 'error');
        chrome.runtime.sendMessage({ type: 'conversionError', error: 'empty' });
        return;
      }

      // 8. Copy to clipboard
      const success = await writeToClipboard(markdown);

      if (success) {
        const charCount = markdown.length;
        const msg = usedFallback
          ? `Partial content captured (${charCount} chars)`
          : `Copied (${charCount} chars)`;
        showToast(msg, usedFallback ? 'warning' : 'success');
        chrome.runtime.sendMessage({ type: 'conversionComplete', charCount, usedFallback, siteMode, markdown });
      } else {
        showToast('Could not copy to clipboard', 'error');
        chrome.runtime.sendMessage({ type: 'conversionError', error: 'clipboard' });
      }
    } catch (err) {
      showToast('Conversion failed: ' + (err.message || 'Unknown error'), 'error');
      chrome.runtime.sendMessage({ type: 'conversionError', error: err.message });
    } finally {
      running = false;
    }
  }

  convert();
})();
