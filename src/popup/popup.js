import { DEFAULT_SETTINGS } from '../utils/defaults.js';
import { PRESET_SELECTORS, CATEGORY_LABELS, CATEGORY_COLORS } from '../utils/presets.js';

const MAX_SELECTORS = 50;
const MAX_SELECTOR_LENGTH = 200;
const FORBIDDEN_PATTERNS = ['[value', '[checked', ':has(', '[name', '[placeholder', '[type='];

// --- Conversion trigger (delegates to background.js) ---

async function triggerConversion() {
  const statusEl = document.getElementById('status');
  statusEl.textContent = 'Converting...';
  document.getElementById('result').className = 'result hidden';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab');

    // Delegate to background service worker (single source of truth)
    chrome.runtime.sendMessage({
      type: 'triggerConversion',
      tabId: tab.id,
      tabUrl: tab.url,
    });
  } catch {
    showResult('error', '✕', 'Cannot access this page');
    statusEl.textContent = 'Error';
  }
}

function showResult(type, icon, text) {
  const resultEl = document.getElementById('result');
  resultEl.className = `result ${type}`;
  document.getElementById('result-icon').textContent = icon;
  document.getElementById('result-text').textContent = text;
}

// Listen for results from content script
chrome.runtime.onMessage.addListener((message, sender) => {
  if (sender.id !== chrome.runtime.id) return;

  if (message.type === 'conversionComplete') {
    const icon = message.usedFallback ? '⚠' : '✓';
    const type = message.usedFallback ? 'warning' : 'success';
    const siteLabel = message.siteMode ? ` · ${message.siteMode}` : '';
    showResult(type, icon, `Copied (${message.charCount} chars${siteLabel})`);
    document.getElementById('status').textContent = 'Done';
    document.getElementById('reconvert').classList.remove('hidden');

    // Show preview
    if (message.markdown) {
      const previewSection = document.getElementById('preview-section');
      document.getElementById('preview-text').textContent = message.markdown;
      previewSection.classList.remove('hidden');
    }
  } else if (message.type === 'conversionError') {
    showResult('error', '✕', message.error || 'Conversion failed');
    document.getElementById('status').textContent = 'Error';
  }
});

// --- Settings management ---

async function loadSettings() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);

  document.getElementById('includeMetadata').checked = settings.includeMetadata;
  document.getElementById('keepImages').checked = settings.keepImages;
  document.getElementById('keepLinks').checked = settings.keepLinks;

  renderPresets(settings.enabledPresets || {});
  renderSelectors(settings.customSelectors);
}

function renderPresets(enabledPresets) {
  const list = document.getElementById('presets-list');
  list.innerHTML = '';

  // Sync Select All checkbox
  const enabledCount = Object.keys(enabledPresets).filter(k => enabledPresets[k]).length;
  const selectAllEl = document.getElementById('toggle-all-presets');
  selectAllEl.checked = enabledCount === PRESET_SELECTORS.length;
  selectAllEl.indeterminate = enabledCount > 0 && enabledCount < PRESET_SELECTORS.length;

  for (let i = 0; i < PRESET_SELECTORS.length; i++) {
    const preset = PRESET_SELECTORS[i];
    const item = document.createElement('label');
    item.className = 'preset-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !!enabledPresets[i];
    checkbox.addEventListener('change', async () => {
      const settings = await chrome.storage.sync.get({ enabledPresets: {} });
      if (checkbox.checked) {
        settings.enabledPresets[i] = true;
      } else {
        delete settings.enabledPresets[i];
      }
      await chrome.storage.sync.set({ enabledPresets: settings.enabledPresets });

      // Sync Select All checkbox
      const count = Object.keys(settings.enabledPresets).filter(k => settings.enabledPresets[k]).length;
      const selectAll = document.getElementById('toggle-all-presets');
      selectAll.checked = count === PRESET_SELECTORS.length;
      selectAll.indeterminate = count > 0 && count < PRESET_SELECTORS.length;
    });

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = CATEGORY_LABELS[preset.category];
    badge.style.backgroundColor = CATEGORY_COLORS[preset.category];

    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = preset.label;

    item.appendChild(checkbox);
    item.appendChild(badge);
    item.appendChild(label);
    list.appendChild(item);
  }
}

function renderSelectors(customSelectors) {
  const list = document.getElementById('selectors-list');
  list.innerHTML = '';

  for (const [domain, selectors] of Object.entries(customSelectors)) {
    for (const sel of selectors) {
      const item = document.createElement('div');
      item.className = 'selector-item';
      const span = document.createElement('span');
      span.textContent = `${domain === '*' ? '(global)' : domain}: ${sel}`;
      const btn = document.createElement('button');
      btn.textContent = '\u00D7';
      btn.dataset.domain = domain;
      btn.dataset.selector = sel;
      item.appendChild(span);
      item.appendChild(btn);
      list.appendChild(item);
    }
  }

  // Delete handler
  list.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', async () => {
      const domain = btn.dataset.domain;
      const selector = btn.dataset.selector;
      const settings = await chrome.storage.sync.get({ customSelectors: {} });
      const selectors = settings.customSelectors[domain] || [];
      settings.customSelectors[domain] = selectors.filter(s => s !== selector);
      if (settings.customSelectors[domain].length === 0) {
        delete settings.customSelectors[domain];
      }
      await chrome.storage.sync.set({ customSelectors: settings.customSelectors });
      renderSelectors(settings.customSelectors);
    });
  });
}

function validateSelector(selector) {
  if (!selector || selector.length > MAX_SELECTOR_LENGTH) {
    return 'Selector too long (max 200 chars)';
  }
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (selector.includes(pattern)) {
      return `Forbidden pattern: ${pattern}`;
    }
  }
  try {
    document.querySelector(selector);
    return null;
  } catch {
    return 'Invalid CSS selector';
  }
}

// --- Event listeners ---

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  triggerConversion();

  // Re-convert button
  document.getElementById('reconvert').addEventListener('click', () => {
    document.getElementById('reconvert').classList.add('hidden');
    triggerConversion();
  });

  // Select All toggle for noise filters
  document.getElementById('toggle-all-presets').addEventListener('change', async (e) => {
    const checked = e.target.checked;
    const enabledPresets = {};
    if (checked) {
      for (let i = 0; i < PRESET_SELECTORS.length; i++) {
        enabledPresets[i] = true;
      }
    }
    await chrome.storage.sync.set({ enabledPresets });
    renderPresets(enabledPresets);
  });

  const toggleIds = ['includeMetadata', 'keepImages', 'keepLinks'];
  for (const id of toggleIds) {
    document.getElementById(id).addEventListener('change', async (e) => {
      await chrome.storage.sync.set({ [id]: e.target.checked });
    });
  }

  document.getElementById('add-selector').addEventListener('click', async () => {
    const selectorInput = document.getElementById('new-selector');
    const domainInput = document.getElementById('new-domain');
    const errorEl = document.getElementById('selector-error');
    const selector = selectorInput.value.trim();
    const domain = domainInput.value.trim() || '*';

    const error = validateSelector(selector);
    if (error) {
      errorEl.textContent = error;
      errorEl.classList.remove('hidden');
      return;
    }

    errorEl.classList.add('hidden');

    const settings = await chrome.storage.sync.get({ customSelectors: {} });
    const all = settings.customSelectors;

    const totalCount = Object.values(all).reduce((sum, arr) => sum + arr.length, 0);
    if (totalCount >= MAX_SELECTORS) {
      errorEl.textContent = `Max ${MAX_SELECTORS} selectors reached`;
      errorEl.classList.remove('hidden');
      return;
    }

    if (!all[domain]) all[domain] = [];
    if (!all[domain].includes(selector)) {
      all[domain].push(selector);
    }

    await chrome.storage.sync.set({ customSelectors: all });
    renderSelectors(all);
    selectorInput.value = '';
    domainInput.value = '';
  });
});
