# Bunbee for WaniKani

> Browser extension that injects [Bunbee](https://bunbee.cc) directly into your [WaniKani](https://www.wanikani.com) reviews: community mnemonics, your private mnemonics, and on-the-fly AI-generated example sentences — all without leaving the review page.

Manifest V3 · Works on Chrome, Edge, and Firefox 109+

---

## What it does

While you're doing reviews on `wanikani.com/subjects/review*`, Bunbee adds a collapsible panel below the review card with two tabs:

- **Mnemonics** — community and personal mnemonics for the current subject, filtered by the question type you're being quizzed on (meaning vs. reading). Vote, comment, save, or write your own without leaving the page.
- **Example sentences** — generates two AI sentences using the current subject as the target word, with reading and English translation. Save the ones you like to your Bunbee Saved tab.

The panel respects WaniKani's flow: it stays collapsed by default, doesn't steal focus while you're typing, and reveals readings only when WK has revealed them too.

## Installation

### From a browser store

| Browser | Link |
|---|---|
| Chrome / Brave / Opera | <https://chrome.google.com/webstore/detail/...> |
| Microsoft Edge | <https://microsoftedge.microsoft.com/addons/...> |
| Firefox | <https://addons.mozilla.org/firefox/addon/bunbee/> |

### Manual installation (development)

Clone or download this repository to a folder you can keep around — the browser loads the extension from disk in this mode.

```bash
git clone https://github.com/<your-org>/bunbee-extension.git
```

#### Chrome / Edge / Brave / Opera (any Chromium)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Toggle **Developer mode** on (top-right corner).
3. Click **Load unpacked**.
4. Pick the `bunbee-extension/` folder (the one containing `manifest.json`).

You'll see "Bunbee for WaniKani" in your extensions list with the bee icon.

#### Firefox

> Firefox 109+ rejects unsigned MV3 extensions in release builds. The temporary-add-on flow below works on every channel but resets when you close the browser. For a permanent install on regular Firefox, the extension needs to be signed by [Mozilla AMO](https://addons.mozilla.org).

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select the **`manifest.json`** file (not the folder).

To make it persist across restarts on regular Firefox you have two options: publish to AMO (recommended), or use Firefox Developer Edition / Nightly with `xpinstall.signatures.required` set to `false` in `about:config`.

### First-time setup

1. Click the Bunbee bee icon in your browser toolbar.
2. Paste your [WaniKani API token](https://www.wanikani.com/settings/personal_access_tokens). Read-only is enough.
3. Click **Connect**. The popup will show "Logged in as &lt;your username&gt;".
4. Open any review session on WaniKani — the Bunbee panel will appear under the review card.

The token is stored locally in `chrome.storage.local` and never leaves your machine except to two endpoints: WaniKani's official API (to fetch readings) and Bunbee's API (to validate the token once at login and exchange it for a session JWT). See [Privacy & data](#privacy--data) below.

## Usage

### Keyboard shortcuts

The shortcuts are inactive while you're typing in WaniKani's answer field, so they never swallow the `b` of `ba` → `ば`.

| Key | Action |
|---|---|
| `B` | Toggle the Bunbee panel (collapsed by default on every new review). |
| `←` / `→` | Switch between the **Mnemonics** and **Example sentences** tabs. |
| `N` | Trigger the active tab's primary action: open the "+ Add" form on Mnemonics, or run "Generate sentences" / "Try again" on Example sentences. |
| `Ctrl+E` / `⌘E` | When typing in the new-mnemonic textarea, wrap the selection in `==…==` highlight markers. |

### Adding a mnemonic in-context

The "+ Add" button (or `N`) opens an inline form that pre-fills:

- **Subject** — the kanji/radical/vocab currently on screen.
- **Type** — auto-selected based on the active question (meaning vs. reading). For radicals it's always `meaning` (WK calls it "Name").
- **Toolbar** — quick-insert buttons for the subject's characters and known readings, plus a Highlight button for `==text==` markers.

The "Make private" checkbox keeps the mnemonic visible only to you in your Saved tab.

## Permissions

Each permission requested in `manifest.json` exists for one specific reason. Useful both as a transparency aid for users and as the justification you'd paste into the Chrome Web Store / AMO submission forms.

| Permission | Why |
|---|---|
| `storage` | Persist your Bunbee session JWT, your WaniKani username, and your WaniKani API token across browser restarts. Used by both the popup and the content script. |
| `https://api.bunbee.cc/*` | Read mnemonics, post your own, vote/comment, and proxy AI sentence generation (the Gemini API key never touches the browser). |
| `https://www.wanikani.com/*` | The content script runs on review pages — needed to detect the active subject, scrape readings from the DOM, and inject the Bunbee panel. |
| `https://api.wanikani.com/*` | Fetch the current subject's readings from WaniKani's official v2 API as a fallback when the DOM hasn't revealed them yet (e.g. before answering). |

The extension does **not** request `<all_urls>`, `tabs`, `activeTab`, or any other broad permission.

## Privacy & data

What lives where, and where it's sent:

- **WaniKani API token** — stored in `chrome.storage.local` on your machine. Sent once to `api.bunbee.cc/api/auth/login` to validate it (Bunbee verifies it against WaniKani and issues a session JWT). After that, it's used directly from the extension to call `api.wanikani.com/v2/subjects/{id}` for readings.
- **Bunbee session JWT** — stored in `chrome.storage.local`. Sent in the `Authorization: Bearer …` header of every Bunbee API call. Expires after 30 days; on expiry, sign back in via the popup.
- **WaniKani username** — stored in `chrome.storage.local` to display "Logged in as &lt;name&gt;" in the popup.
- **Subject IDs and characters** — sent to `api.bunbee.cc` to look up mnemonics for the subject you're reviewing.
- **AI sentence prompts** — when you click "Generate sentences", the active subject's character is sent to `api.bunbee.cc/api/geminiproxy/generate`, which forwards a prompt to Google Gemini. No personally identifiable information is included.

Nothing is shared with third parties beyond the three endpoints listed in [Permissions](#permissions). Logging out from the popup wipes all locally stored data.

## File structure

```
bunbee-extension/
├── manifest.json    Manifest V3 declaration (entry points, permissions, gecko id)
├── popup.html       UI of the toolbar popup (sign in / sign out)
├── popup.js         Popup logic: WK token validation, JWT exchange, storage
├── content.js       Content script: panel injection, mnemonics list, "+ Add" form,
│                    AI sentence generation, keyboard shortcuts
├── content.css      Panel styles (CSP-safe — no inline styles, no remote fonts)
└── icons/           16 / 48 / 128 px PNGs, used by the toolbar action and stores
```

The extension intentionally has **no build step**: every file is shipped as-is. Material Symbols icons are inlined as SVG paths in `content.js` rather than loaded from Google Fonts to comply with WaniKani's `font-src` CSP.

## Development

### Hot-reloading

There isn't any. After editing a file:

- **Chrome / Edge**: open `chrome://extensions`, click the refresh icon on the Bunbee card. Then refresh the WaniKani tab.
- **Firefox**: open `about:debugging#/runtime/this-firefox`, click "Reload" next to Bunbee. Then refresh the WaniKani tab.

### Debugging the content script

- **Chrome**: DevTools on the WaniKani page → **Sources** → **Content scripts** → **Bunbee** → `content.js`. Set breakpoints there.
- **Firefox**: `about:debugging#/runtime/this-firefox` → **Inspect** next to Bunbee → opens a dedicated DevTools window scoped to the extension.

### Debugging the popup

Right-click the bee icon in the toolbar → **Inspect popup**. The popup window stays open while DevTools is attached.

### Useful console hook

`content.js` exposes a small debug helper on `window._bunbee`:

```js
window._bunbee.reload()  // re-fetches mnemonics for the current subject
```

Run it from the WaniKani page's console.

## License

[MIT](LICENSE) &copy; 2026 Sergio Enrique García Sánchez
