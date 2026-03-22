# Privacy Policy — HTML to MD

**Last updated:** 2026-03-22

## Data Collection

HTML to MD does **not** collect, store, or transmit any user data.

## How It Works

- The extension reads the current page's DOM **locally** in your browser
- Content is converted to Markdown and copied to your **local clipboard**
- No data is sent to any server, API, or third-party service
- No analytics, telemetry, or tracking of any kind

## Storage

- User preferences (toggle settings, custom CSS selectors) are stored in `chrome.storage.sync`
- This data syncs across your Chrome browsers via your Google account (standard Chrome behavior)
- Only settings are stored — **never** page content

## Permissions

| Permission | Why |
|------------|-----|
| `activeTab` | Read the current page's DOM when you click the icon or use the shortcut |
| `clipboardWrite` | Copy the converted Markdown to your clipboard |
| `scripting` | Inject the conversion script into the active tab |
| `storage` | Save your preferences (settings, custom selectors) |

## Contact

For questions about this privacy policy, open an issue at [github.com/minsoo-web/html-to-md](https://github.com/minsoo-web/html-to-md).
