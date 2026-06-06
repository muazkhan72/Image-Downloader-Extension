import { createZip } from "./lib/zip.js";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "DOWNLOAD_IMAGES") {
    downloadImages(message.images, message.pageTitle, message.asZip)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  return false;
});

function sanitizeFolderName(title) {
  const cleaned = (title || "page-images")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/, "");
  return cleaned.slice(0, 80) || "page-images";
}

async function downloadImages(images, pageTitle, asZip) {
  const folder = sanitizeFolderName(pageTitle);

  if (asZip) {
    return downloadAsZip(images, folder);
  }
  return downloadSeparately(images, folder);
}

async function downloadSeparately(images, folder) {
  let success = 0;
  let failed = 0;
  const errors = [];

  for (const image of images) {
    try {
      await chrome.downloads.download({
        url: image.url,
        filename: `page-images/${folder}/${image.filename}`,
        conflictAction: "uniquify",
        saveAs: false,
      });
      success += 1;
      await delay(100);
    } catch (error) {
      failed += 1;
      errors.push({ filename: image.filename, error: error.message });
    }
  }

  return { success, failed, errors };
}

async function downloadAsZip(images, folder) {
  const files = [];
  const errors = [];

  for (const image of images) {
    try {
      const data = await loadImageBytes(image.url);
      files.push({ name: image.filename, data });
    } catch (error) {
      errors.push({ filename: image.filename, error: error.message });
    }
  }

  if (files.length === 0) {
    throw new Error("Could not fetch any images for the ZIP archive.");
  }

  const zipBytes = createZip(files);
  const blob = new Blob([zipBytes], { type: "application/zip" });
  const objectUrl = URL.createObjectURL(blob);

  try {
    await chrome.downloads.download({
      url: objectUrl,
      filename: `page-images/${folder}.zip`,
      conflictAction: "uniquify",
      saveAs: false,
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }

  return {
    success: files.length,
    failed: errors.length,
    errors,
  };
}

async function loadImageBytes(url) {
  if (url.startsWith("data:")) {
    return dataUrlToBytes(url);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function dataUrlToBytes(dataUrl) {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) throw new Error("Invalid data URL");

  const meta = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);

  if (meta.includes(";base64")) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  const decoded = decodeURIComponent(payload);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i += 1) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return bytes;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
