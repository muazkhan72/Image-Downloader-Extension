# Image Downloader — Chrome Extension

A Chrome extension that finds every image on the current web page and lets you **select**, **filter**, and **download** them — either as separate files or a single ZIP archive.

All processing happens locally in your browser. No accounts, no servers, no data is sent anywhere.

---

## Features

- Scans the active tab for images from `<img>`, `<picture>`, SVG, video posters, favicons, and CSS backgrounds
- **Select individual images** with checkboxes (Select all / Select none)
- **Filters** — minimum width/height, file type (JPG, PNG, GIF, WebP, SVG, ICO, AVIF, BMP)
- **Download modes**
  - Separate files in a page-titled folder
  - Single ZIP archive
- Saves to `Downloads/page-images/` using the **page title** as the folder or ZIP name
- Thumbnail previews with filename, dimensions, and source type

---

## Install from GitHub

### 1. Get the code

**Option A — Download ZIP**

1. Open this repository on GitHub
2. Click **Code** → **Download ZIP**
3. Extract the ZIP to a folder on your computer

**Option B — Clone with Git**

```bash
git clone https://github.com/YOUR_USERNAME/image-downloader-extension.git
cd image-downloader-extension
```

### 2. Load in Chrome

1. Open Chrome and go to `chrome://extensions`
2. Turn on **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the project folder (the one that contains `manifest.json`)
5. The **Image Downloader** icon appears in your toolbar

### 3. Use the extension

1. Open any regular website (not `chrome://` pages)
2. Click the extension icon
3. Wait for the scan to finish
4. Adjust filters and select the images you want
5. Choose **Separate files** or **Single ZIP**
6. Click **Download selected images**

Files are saved under your default Downloads folder:

- Separate files: `Downloads/page-images/{Page Title}/`
- ZIP: `Downloads/page-images/{Page Title}.zip`

---

## Install in Microsoft Edge

Edge is Chromium-based and supports the same steps:

1. Go to `edge://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this folder

---

## Updating to a new version

If you installed from GitHub:

1. Download the latest code (or run `git pull`)
2. Go to `chrome://extensions`
3. Click the **refresh** icon on the Image Downloader card

---

## Publish on Chrome Web Store (optional)

To let anyone install with one click:

1. Create a [Chrome Web Store Developer account](https://chrome.google.com/webstore/devconsole) (one-time registration fee)
2. Zip the extension folder (include `manifest.json`, all `.js` / `.html` / `.css` files, `icons/`, and `lib/`)
3. Upload the ZIP in the Developer Dashboard → **New item**
4. Add listing details, screenshots, and a privacy policy
5. Submit for review

Your extension uses `<all_urls>` so reviewers will expect a clear explanation that images are only read from the active tab when the user opens the popup, and nothing is uploaded to external servers.

---

## Permissions

| Permission | Why it's needed |
|------------|-----------------|
| `activeTab` | Access the current tab when you click the extension |
| `scripting` | Inject the image scanner into the page |
| `downloads` | Save images and ZIP files to your Downloads folder |
| `<all_urls>` | Fetch image data for ZIP creation and cross-origin images |

---

## Privacy

- Images are scanned only when **you** open the extension popup
- Downloads are saved locally to your computer
- No analytics, tracking, or external servers
- No data is collected or transmitted

---

## Project structure

```
├── manifest.json      # Extension configuration
├── popup.html         # Popup UI
├── popup.css          # Popup styles
├── popup.js           # Selection, filters, and UI logic
├── content.js         # Image extraction (injected into pages)
├── background.js      # Download and ZIP handling
├── lib/
│   └── zip.js         # ZIP archive builder
└── icons/             # Extension icons (16, 48, 128 px)
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "This page type cannot be scanned" | Open a normal website (`https://...`). Browser internal pages (`chrome://`, `edge://`) are blocked. |
| No images found | Try enabling **Include CSS background images** and click **Rescan page**. |
| Some images fail in ZIP mode | Cross-origin or protected images may block fetching. Try **Separate files** mode instead. |
| Extension not updating | Click refresh on `chrome://extensions` after replacing the files. |

---

## Development

No build step required — edit the files and reload the extension on `chrome://extensions`.

Requirements:

- Google Chrome or Microsoft Edge (Chromium)
- Developer mode enabled for local install

---

## License

MIT License — free to use, modify, and share. See [LICENSE](LICENSE) for details.

---

## Contributing

Pull requests are welcome. For large changes, open an issue first to discuss what you'd like to change.
