export const PRESET_SELECTORS = [
  // Ads
  { selector: '.adsbygoogle, ins.adsbygoogle', category: 'ads', label: 'Google AdSense' },
  { selector: '[id^="google_ads"], iframe[id^="google_ads"]', category: 'ads', label: 'Google Ads iframe' },
  { selector: '[id^="div-gpt-ad"]', category: 'ads', label: 'Google Publisher Tag' },
  { selector: '[data-ad], [data-ad-slot], [data-google-query-id]', category: 'ads', label: 'Generic ad slots' },
  { selector: '.ad-banner, .ad-container, .ad-wrapper, [class*="ad-slot"]', category: 'ads', label: 'Ad containers' },
  { selector: '.sponsored, .ad-placement, [class*="sponsored"]', category: 'ads', label: 'Sponsored content' },
  { selector: '.OUTBRAIN, .outbrain, [id^="taboola"]', category: 'ads', label: 'Outbrain / Taboola' },

  // Cookie / Consent
  { selector: '#CybotCookiebotDialog, #CybotCookiebotDialogOverlay', category: 'cookie', label: 'Cookiebot' },
  { selector: '#onetrust-banner-sdk, #onetrust-consent-sdk', category: 'cookie', label: 'OneTrust' },
  { selector: '.cc-banner, .cc-window, #cookie-law-info-bar', category: 'cookie', label: 'Cookie consent banners' },
  { selector: '[class*="cookie-banner"], [id*="cookie-notice"]', category: 'cookie', label: 'Generic cookie notices' },

  // Social / Sharing
  { selector: '.addthis_toolbox, #at-share-dock, [class*="addthis"]', category: 'social', label: 'AddThis' },
  { selector: '[class*="share-bar"], [class*="social-share"], .share-buttons', category: 'social', label: 'Share buttons' },

  // Chat Widgets
  { selector: '#intercom-container, .intercom-lightweight-app', category: 'chat', label: 'Intercom' },
  { selector: '.drift-widget, #drift-widget', category: 'chat', label: 'Drift' },
  { selector: '#hubspot-messages-iframe-container', category: 'chat', label: 'HubSpot Chat' },
  { selector: '[class*="crisp-client"], #crisp-chatbox', category: 'chat', label: 'Crisp' },
  { selector: '#tidio-chat, #tidio-chat-iframe', category: 'chat', label: 'Tidio' },

  // Noise (popups, newsletters, etc.)
  { selector: '[class*="newsletter"], [class*="subscribe-form"]', category: 'noise', label: 'Newsletter prompts' },
  { selector: '[class*="popup-overlay"], [class*="modal-backdrop"]', category: 'noise', label: 'Popup overlays' },
  { selector: '[class*="related-posts"], [class*="recommended-articles"]', category: 'noise', label: 'Related/recommended' },
];

export const CATEGORY_LABELS = {
  ads: 'Ads',
  cookie: 'Cookie',
  social: 'Social',
  chat: 'Chat',
  noise: 'Noise',
};

export const CATEGORY_COLORS = {
  ads: '#cf222e',
  cookie: '#9a6700',
  social: '#0969da',
  chat: '#8250df',
  noise: '#6e7781',
};
