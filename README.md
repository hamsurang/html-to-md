# HTML to MD

Chrome extension that converts web pages to clean Markdown optimized for AI agents.

One click to extract the main content from any web page, strip noise (ads, nav, footer, cookie banners), and copy token-efficient Markdown to your clipboard.

## Features

- **One-click conversion** — click the icon or press `Cmd+Shift+M` / `Ctrl+Shift+M`
- **Smart extraction** — uses [Readability](https://github.com/mozilla/readability) to detect main content
- **Site-specific rules** — optimized extraction for GitHub, Stack Overflow, Medium, Substack
- **Token-efficient output** — ~80% fewer tokens compared to raw HTML
- **Noise filters** — built-in presets for ads, cookie banners, chat widgets, and more
- **Custom selectors** — add your own CSS selectors to remove unwanted elements
- **Markdown preview** — inspect the converted output before pasting
- **Privacy-first** — no data collection, no network requests, everything runs locally

## Install

### Chrome Web Store

Coming soon.

### Manual Install (Developer Mode)

1. Clone and build:

```bash
git clone https://github.com/hamsurang/html-to-md.git
cd html-to-md
pnpm install
pnpm run build
```

2. Load in Chrome:
   - Go to `chrome://extensions`
   - Enable **Developer mode** (top-right toggle)
   - Click **Load unpacked** and select the `dist/` folder

## Usage

1. Navigate to any web page
2. Click the extension icon or press `Cmd+Shift+M` (Mac) / `Ctrl+Shift+M` (Windows/Linux)
3. The popup shows the result — markdown is automatically copied to your clipboard
4. Click **Preview markdown** to inspect the output
5. Adjust settings and click **Re-convert & Copy** to re-run with new options

### Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Include title & URL | Prepend page title and source URL | On |
| Include images | Keep `![alt](src)` in output | On |
| Include link URLs | Keep `[text](href)` vs text only | On |

### Noise Filters

Built-in presets for removing common noise elements:

| Category | Examples |
|----------|---------|
| **Ads** | Google AdSense, GPT, Outbrain, Taboola |
| **Cookie** | Cookiebot, OneTrust, generic banners |
| **Social** | AddThis, share buttons |
| **Chat** | Intercom, Drift, HubSpot, Crisp, Tidio |
| **Noise** | Newsletter prompts, popups, related articles |

### Site-Specific Extraction

Automatically detected — no configuration needed:

| Site | What's extracted |
|------|-----------------|
| **GitHub** | README, Issue/PR threads (with authors), code blobs, release notes |
| **Stack Overflow** | Question + all answers with vote scores and accepted markers |
| **Medium** | Article body |
| **Substack** | Post content |

## Development

```bash
pnpm install        # install dependencies
pnpm run dev        # watch mode (auto-rebuild on changes)
pnpm run build      # production build
pnpm test           # run tests
```

After building, reload the extension in `chrome://extensions` (click the refresh icon).

### Project Structure

```
src/
  background.js              # service worker (shortcuts, badge, message relay)
  content.js                 # conversion pipeline (extract → clean → convert → copy)
  converter/
    readability-extractor.js # Readability wrapper with subtree optimization
    dom-cleaner.js           # HTML sanitization (strip attrs, form elements, scripts)
    turndown-converter.js    # Turndown with token-optimized custom rules
    site-rules/              # per-site extraction (GitHub, SO, Medium, Substack)
  popup/                     # popup UI (settings, preview, re-convert)
  utils/                     # clipboard, toast, metadata, post-processing, presets
```

### Architecture

```
Popup click / Keyboard shortcut
  → Service worker reads settings
  → Content script injected into active tab
  → Pipeline: Site rules OR Readability → DOM clean → Turndown → Post-process
  → Clipboard write + toast notification
```

## How It Works

1. **Content extraction** — Site-specific CSS selectors for known sites, or Mozilla Readability for generic pages
2. **DOM sanitization** — Strips scripts, event handlers, form elements, tracking attributes, and `<base>` tags
3. **Markdown conversion** — Turndown.js with custom rules for token efficiency (flatten deep headings, collapse BR chains, optimize images/links)
4. **Post-processing** — Normalize whitespace, strip decorative Unicode characters

## Contributing

Contributions are welcome! Some areas where help is appreciated:

- Adding site-specific rules for new sites
- Improving noise filter presets
- Bug reports and feature requests

Please open an issue first to discuss changes.

## License

[MIT](LICENSE)
