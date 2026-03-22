import { DEFAULT_SETTINGS } from './utils/defaults.js';

// Badge state helpers
const Badge = {
  async setLoading(tabId) {
    await chrome.action.setBadgeText({ text: '...', tabId });
    await chrome.action.setBadgeBackgroundColor({ color: '#6e7781', tabId });
  },
  async setSuccess(tabId) {
    await chrome.action.setBadgeText({ text: '✓', tabId });
    await chrome.action.setBadgeBackgroundColor({ color: '#1a7f37', tabId });
    setTimeout(() => chrome.action.setBadgeText({ text: '', tabId }), 2000);
  },
  async setError(tabId) {
    await chrome.action.setBadgeText({ text: '!', tabId });
    await chrome.action.setBadgeBackgroundColor({ color: '#cf222e', tabId });
    setTimeout(() => chrome.action.setBadgeText({ text: '', tabId }), 4000);
  },
};

// Shared conversion logic — used by both shortcut and popup message
async function convertTab(tabId, tabUrl) {
  try {
    const url = new URL(tabUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      await Badge.setError(tabId);
      return;
    }
  } catch {
    await Badge.setError(tabId);
    return;
  }

  await Badge.setLoading(tabId);

  try {
    const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);

    await chrome.scripting.executeScript({
      target: { tabId },
      func: (s) => { window.__htmlToMdSettings = s; },
      args: [settings],
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
  } catch {
    await Badge.setError(tabId);
  }
}

// Keyboard shortcut handler
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'convert-page') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  await convertTab(tab.id, tab.url);
});

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender) => {
  if (sender.id !== chrome.runtime.id) return;

  // Popup requests conversion
  if (message.type === 'triggerConversion' && message.tabId && message.tabUrl) {
    convertTab(message.tabId, message.tabUrl);
    return;
  }

  // Content script results (relay badge state)
  const tabId = sender.tab?.id;
  if (!tabId) return;

  if (message.type === 'conversionComplete') {
    Badge.setSuccess(tabId);
  } else if (message.type === 'conversionError') {
    Badge.setError(tabId);
  }
});
