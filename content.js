(function () {
  const includeBackgrounds = window.__imageDownloaderIncludeBackgrounds !== false;
  const IMAGE_EXT = /\.(jpe?g|png|gif|webp|svg|bmp|ico|avif|tiff?)(\?|#|$)/i;
  const DATA_IMAGE_PREFIX = /^data:image\//i;

  function resolveUrl(raw, base) {
    if (!raw || typeof raw !== "string") return null;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("javascript:")) return null;
    try {
      return new URL(trimmed, base).href;
    } catch {
      return null;
    }
  }

  function parseSrcset(srcset, base) {
    if (!srcset) return [];
    return srcset
      .split(",")
      .map((part) => part.trim().split(/\s+/)[0])
      .map((url) => resolveUrl(url, base))
      .filter(Boolean);
  }

  function extractUrlsFromCss(cssText, base) {
    if (!cssText) return [];
    const urls = [];
    const regex = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
    let match;
    while ((match = regex.exec(cssText)) !== null) {
      const resolved = resolveUrl(match[2], base);
      if (resolved) urls.push(resolved);
    }
    return urls;
  }

  function guessExtension(url) {
    try {
      const pathname = new URL(url).pathname;
      const ext = pathname.match(/\.([a-z0-9]+)$/i);
      if (ext) return ext[1].toLowerCase();
    } catch {
      /* ignore */
    }
    if (DATA_IMAGE_PREFIX.test(url)) {
      const mime = url.slice(5, url.indexOf(";"));
      const map = {
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/png": "png",
        "image/gif": "gif",
        "image/webp": "webp",
        "image/svg+xml": "svg",
        "image/bmp": "bmp",
        "image/x-icon": "ico",
        "image/avif": "avif",
        "image/tiff": "tiff",
      };
      return map[mime] || "jpg";
    }
    return "jpg";
  }

  function sanitizeFilename(name) {
    return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/\.+$/, "") || "image";
  }

  function filenameFromUrl(url, index) {
    try {
      const parsed = new URL(url);
      const segment = parsed.pathname.split("/").pop() || "";
      const decoded = decodeURIComponent(segment.split("?")[0].split("#")[0]);
      if (decoded && IMAGE_EXT.test(decoded)) {
        return sanitizeFilename(decoded);
      }
    } catch {
      /* ignore */
    }
    const ext = guessExtension(url);
    return `image-${String(index).padStart(3, "0")}.${ext}`;
  }

  function looksLikeImageUrl(url) {
    if (DATA_IMAGE_PREFIX.test(url)) return true;
    if (url.startsWith("blob:")) return true;
    try {
      const pathname = new URL(url).pathname;
      return IMAGE_EXT.test(pathname) || pathname.includes("/image");
    } catch {
      return false;
    }
  }

  function addImage(map, url, source, dimensions) {
    if (!url || !looksLikeImageUrl(url)) return;
    if (!map.has(url)) {
      map.set(url, { url, source, width: dimensions?.width || 0, height: dimensions?.height || 0 });
    } else if (dimensions?.width && dimensions?.height) {
      const existing = map.get(url);
      if (!existing.width || !existing.height) {
        existing.width = dimensions.width;
        existing.height = dimensions.height;
      }
    }
  }

  async function blobUrlToDataUrl(blobUrl) {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  function probeImageSize(url, timeoutMs = 2500) {
    return new Promise((resolve) => {
      const img = new Image();
      let settled = false;

      const finish = (width, height) => {
        if (settled) return;
        settled = true;
        resolve({ width, height });
      };

      const timer = setTimeout(() => finish(0, 0), timeoutMs);
      img.onload = () => finish(img.naturalWidth || 0, img.naturalHeight || 0);
      img.onerror = () => finish(0, 0);
      img.src = url;
    });
  }

  async function mapWithConcurrency(items, limit, worker) {
    const results = new Array(items.length);
    let index = 0;

    async function run() {
      while (index < items.length) {
        const current = index;
        index += 1;
        results[current] = await worker(items[current], current);
      }
    }

    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
    return results;
  }

  async function collectImages() {
    const base = document.baseURI;
    const map = new Map();

    document.querySelectorAll("img").forEach((img) => {
      const dims = {
        width: img.naturalWidth || img.width || 0,
        height: img.naturalHeight || img.height || 0,
      };
      addImage(map, resolveUrl(img.currentSrc || img.src, base), "img", dims);
      parseSrcset(img.srcset, base).forEach((url) => addImage(map, url, "img-srcset", dims));
      addImage(map, resolveUrl(img.getAttribute("data-src"), base), "img-lazy", dims);
      addImage(map, resolveUrl(img.getAttribute("data-lazy-src"), base), "img-lazy", dims);
    });

    document.querySelectorAll("picture source").forEach((source) => {
      addImage(map, resolveUrl(source.src, base), "picture");
      parseSrcset(source.srcset, base).forEach((url) => addImage(map, url, "picture-srcset"));
    });

    document.querySelectorAll("image").forEach((node) => {
      addImage(map, resolveUrl(node.getAttribute("href") || node.getAttribute("xlink:href"), base), "svg-image");
    });

    document.querySelectorAll("video[poster]").forEach((video) => {
      addImage(map, resolveUrl(video.poster, base), "video-poster");
    });

    document.querySelectorAll("input[type='image']").forEach((input) => {
      addImage(map, resolveUrl(input.src, base), "input-image");
    });

    if (includeBackgrounds) {
      document.querySelectorAll("*").forEach((el) => {
        const inline = el.getAttribute("style");
        extractUrlsFromCss(inline, base).forEach((url) => addImage(map, url, "inline-style"));

        try {
          const bg = getComputedStyle(el).backgroundImage;
          extractUrlsFromCss(bg, base).forEach((url) => addImage(map, url, "background"));
        } catch {
          /* ignore */
        }
      });
    }

    document.querySelectorAll("link[rel*='icon'], link[rel='apple-touch-icon']").forEach((link) => {
      addImage(map, resolveUrl(link.href, base), "favicon");
    });

    const entries = Array.from(map.values());
    await mapWithConcurrency(entries, 6, async (entry) => {
      if (!entry.width || !entry.height) {
        const dims = await probeImageSize(entry.url);
        entry.width = dims.width;
        entry.height = dims.height;
      }
    });

    const usedNames = new Map();
    const prepared = [];

    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      let url = entry.url;
      let filename = filenameFromUrl(url, i + 1);
      const extension = guessExtension(url);

      if (url.startsWith("blob:")) {
        try {
          url = await blobUrlToDataUrl(url);
          filename = filename.replace(/\.[^.]+$/, "") + "." + guessExtension(url);
        } catch {
          continue;
        }
      }

      const stem = filename.includes(".") ? filename.slice(0, filename.lastIndexOf(".")) : filename;
      const ext = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")) : "";
      const count = usedNames.get(filename) || 0;
      usedNames.set(filename, count + 1);
      if (count > 0) {
        filename = `${stem}-${count + 1}${ext}`;
      }

      prepared.push({
        id: `img-${i + 1}`,
        url,
        filename,
        source: entry.source,
        width: entry.width || 0,
        height: entry.height || 0,
        extension,
      });
    }

    return prepared;
  }

  return collectImages();
})();
