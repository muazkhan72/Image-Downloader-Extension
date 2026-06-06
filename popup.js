const imageCountEl = document.getElementById("image-count");
const selectedCountEl = document.getElementById("selected-count");
const statusEl = document.getElementById("status");
const pageTitleEl = document.getElementById("page-title");
const folderHintEl = document.getElementById("folder-hint");
const downloadBtn = document.getElementById("download-btn");
const scanBtn = document.getElementById("scan-btn");
const includeBackgroundsEl = document.getElementById("include-backgrounds");
const minWidthEl = document.getElementById("min-width");
const minHeightEl = document.getElementById("min-height");
const imageListEl = document.getElementById("image-list");
const selectAllBtn = document.getElementById("select-all-btn");
const selectNoneBtn = document.getElementById("select-none-btn");
const typeFilterEls = Array.from(document.querySelectorAll(".type-filter"));
const downloadModeEls = Array.from(document.querySelectorAll('input[name="download-mode"]'));

const EXT_ALIASES = {
  jpg: ["jpg", "jpeg"],
  png: ["png"],
  gif: ["gif"],
  webp: ["webp"],
  svg: ["svg"],
  ico: ["ico"],
  avif: ["avif"],
  bmp: ["bmp", "tiff", "tif"],
};

let allImages = [];
let filteredImages = [];
let selectedIds = new Set();
let currentPageTitle = "page-images";

document.addEventListener("DOMContentLoaded", () => {
  scanPage();
  updateFolderHint();
});

scanBtn.addEventListener("click", scanPage);
selectAllBtn.addEventListener("click", () => setSelectionForFiltered(true));
selectNoneBtn.addEventListener("click", () => setSelectionForFiltered(false));

downloadBtn.addEventListener("click", async () => {
  const images = getSelectedImages();
  if (!images.length) return;

  const asZip = getDownloadMode() === "zip";
  setStatus(asZip ? "Building ZIP archive…" : "Starting downloads…");
  downloadBtn.disabled = true;
  scanBtn.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({
      type: "DOWNLOAD_IMAGES",
      images,
      pageTitle: currentPageTitle,
      asZip,
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Download failed.");
    }

    const { success, failed } = response;
    if (failed > 0) {
      setStatus(`Downloaded ${success} image(s). ${failed} failed.`, "error");
    } else {
      setStatus(
        asZip
          ? `ZIP archive created with ${success} image(s).`
          : `Downloaded ${success} image(s) successfully.`,
        "success"
      );
    }
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    updateDownloadButton();
    scanBtn.disabled = false;
  }
});

includeBackgroundsEl.addEventListener("change", () => {
  if (includeBackgroundsEl.checked) {
    scanPage();
  } else {
    applyFilter();
  }
});

minWidthEl.addEventListener("change", applyFilter);
minHeightEl.addEventListener("change", applyFilter);
minWidthEl.addEventListener("input", applyFilter);
minHeightEl.addEventListener("input", applyFilter);

typeFilterEls.forEach((el) => el.addEventListener("change", applyFilter));
downloadModeEls.forEach((el) => el.addEventListener("change", updateFolderHint));

async function scanPage() {
  setStatus("Scanning the active tab…");
  downloadBtn.disabled = true;
  scanBtn.disabled = true;
  imageCountEl.textContent = "…";
  selectedCountEl.textContent = "0";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error("No active tab found.");
    }

    if (tab.url?.startsWith("chrome://") || tab.url?.startsWith("edge://") || tab.url?.startsWith("chrome-extension://")) {
      throw new Error("This page type cannot be scanned. Open a regular website first.");
    }

    currentPageTitle = tab.title || "page-images";
    pageTitleEl.textContent = currentPageTitle;
    updateFolderHint();

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (includeBackgrounds) => {
        window.__imageDownloaderIncludeBackgrounds = includeBackgrounds;
      },
      args: [includeBackgroundsEl.checked],
    });

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });

    allImages = result || [];
    selectedIds = new Set(allImages.map((image) => image.id));
    applyFilter();
  } catch (error) {
    allImages = [];
    filteredImages = [];
    selectedIds.clear();
    imageCountEl.textContent = "0";
    selectedCountEl.textContent = "0";
    renderImageList();
    setStatus(error.message, "error");
    downloadBtn.disabled = true;
  } finally {
    scanBtn.disabled = false;
  }
}

function applyFilter() {
  filteredImages = filterImages(allImages);
  imageCountEl.textContent = String(filteredImages.length);

  const visibleIds = new Set(filteredImages.map((image) => image.id));
  selectedIds = new Set([...selectedIds].filter((id) => visibleIds.has(id)));

  renderImageList();
  updateCounts();

  if (filteredImages.length === 0) {
    setStatus(allImages.length > 0 ? "No images match the current filters." : "No images found on this page.");
  } else {
    setStatus(`${selectedIds.size} of ${filteredImages.length} image(s) selected.`);
  }

  updateDownloadButton();
}

function filterImages(images) {
  const minWidth = Number(minWidthEl.value) || 0;
  const minHeight = Number(minHeightEl.value) || 0;
  const allowedTypes = getSelectedTypes();

  return images.filter((image) => {
    if (!includeBackgroundsEl.checked && (image.source.includes("background") || image.source.includes("inline-style"))) {
      return false;
    }

    if (minWidth > 0 && (image.width || 0) < minWidth) return false;
    if (minHeight > 0 && (image.height || 0) < minHeight) return false;

    const ext = normalizeExtension(image.extension);
    return allowedTypes.has(ext);
  });
}

function getSelectedTypes() {
  const selected = new Set();
  for (const el of typeFilterEls) {
    if (!el.checked) continue;
    const aliases = EXT_ALIASES[el.value] || [el.value];
    aliases.forEach((ext) => selected.add(ext));
  }
  return selected;
}

function normalizeExtension(ext) {
  const value = (ext || "jpg").toLowerCase();
  if (value === "jpeg") return "jpg";
  if (value === "tif") return "tiff";
  return value;
}

function renderImageList() {
  imageListEl.innerHTML = "";
  imageListEl.classList.toggle("empty", filteredImages.length === 0);

  if (filteredImages.length === 0) {
    imageListEl.textContent = "No images to show.";
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const image of filteredImages) {
    const item = document.createElement("label");
    item.className = "image-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedIds.has(image.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedIds.add(image.id);
      } else {
        selectedIds.delete(image.id);
      }
      updateCounts();
      updateDownloadButton();
      setStatus(`${selectedIds.size} of ${filteredImages.length} image(s) selected.`);
    });

    const thumbWrap = document.createElement("div");
    thumbWrap.className = "thumb-wrap";

    if (image.url.length < 2_000_000) {
      const thumb = document.createElement("img");
      thumb.src = image.url;
      thumb.alt = "";
      thumb.loading = "lazy";
      thumb.addEventListener("error", () => {
        thumb.remove();
        thumbWrap.innerHTML = '<span class="thumb-fallback">No preview</span>';
      });
      thumbWrap.appendChild(thumb);
    } else {
      thumbWrap.innerHTML = '<span class="thumb-fallback">Large image</span>';
    }

    const meta = document.createElement("div");
    meta.className = "image-meta";

    const name = document.createElement("span");
    name.className = "image-name";
    name.textContent = image.filename;
    name.title = image.filename;

    const details = document.createElement("span");
    details.className = "image-details";
    const sizeLabel = image.width && image.height ? `${image.width} × ${image.height}` : "Unknown size";
    details.textContent = `${sizeLabel} · ${image.extension.toUpperCase()} · ${image.source}`;

    meta.append(name, details);
    item.append(checkbox, thumbWrap, meta);
    fragment.appendChild(item);
  }

  imageListEl.appendChild(fragment);
}

function setSelectionForFiltered(selectAll) {
  if (selectAll) {
    filteredImages.forEach((image) => selectedIds.add(image.id));
  } else {
    filteredImages.forEach((image) => selectedIds.delete(image.id));
  }
  renderImageList();
  updateCounts();
  updateDownloadButton();
  setStatus(`${selectedIds.size} of ${filteredImages.length} image(s) selected.`);
}

function getSelectedImages() {
  return filteredImages.filter((image) => selectedIds.has(image.id));
}

function updateCounts() {
  selectedCountEl.textContent = String(getSelectedImages().length);
}

function updateDownloadButton() {
  downloadBtn.disabled = getSelectedImages().length === 0;
}

function getDownloadMode() {
  const selected = downloadModeEls.find((el) => el.checked);
  return selected?.value || "separate";
}

function updateFolderHint() {
  const folder = sanitizeFolderName(currentPageTitle);
  if (getDownloadMode() === "zip") {
    folderHintEl.innerHTML = `Saves <code>Downloads/page-images/${escapeHtml(folder)}.zip</code>`;
  } else {
    folderHintEl.innerHTML = `Saves files in <code>Downloads/page-images/${escapeHtml(folder)}/</code>`;
  }
}

function sanitizeFolderName(title) {
  const cleaned = (title || "page-images")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/, "");
  return cleaned.slice(0, 80) || "page-images";
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = "status";
  if (type) statusEl.classList.add(type);
}
