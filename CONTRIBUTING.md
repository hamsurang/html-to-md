# Contributing

Thanks for your interest in contributing to HTML to MD!

## Getting Started

```bash
git clone https://github.com/hamsurang/html-to-md.git
cd html-to-md
pnpm install
pnpm run dev
```

Load `dist/` in Chrome via `chrome://extensions` (Developer mode).

## Adding a Site Rule

1. Create a new file in `src/converter/site-rules/` (e.g., `reddit.js`)
2. Export an extraction function that returns an HTML string or `null`
3. Register it in `src/converter/site-rules/index.js`:
   - Add the hostname mapping to `SITE_MAP`
   - Add the extractor to `EXTRACTORS`
4. The extractor should use `element.outerHTML` on targeted selectors (avoid `document.cloneNode`)
5. Return `null` to fall back to Readability

## Adding a Noise Filter Preset

Edit `src/utils/presets.js` and add an entry to `PRESET_SELECTORS`:

```js
{ selector: '.my-noise-element', category: 'ads', label: 'My Noise' },
```

Categories: `ads`, `cookie`, `social`, `chat`, `noise`.

## Code Style

- No TypeScript — plain JavaScript with ES modules
- No linter configured — keep code clean and consistent with existing patterns
- Use `const`/`let`, no `var`
- Prefer early returns over deep nesting

## Testing

```bash
pnpm test
```

Tests use Node.js built-in test runner. Browser-dependent code (DOM APIs) is not unit-tested — test manually in Chrome.

## Pull Requests

1. Create a feature branch from `main`
2. Make your changes
3. Run `pnpm run build && pnpm test`
4. Open a PR with a clear description
