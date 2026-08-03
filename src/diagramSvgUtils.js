/** Shared SVG helpers for circuit / equipment / chemistry stem diagrams. */

export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

/** Convert SVG markup to a PNG Blob for Supabase Storage upload. */
export function svgMarkupToPngBlob(svgMarkup, { width = 720, height = 560, scale = 2 } = {}) {
  return new Promise((resolve, reject) => {
    let svg = String(svgMarkup || "").trim();
    if (!svg) {
      reject(new Error("Empty SVG"));
      return;
    }
    if (!svg.includes("xmlns=")) {
      svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (!/width=/.test(svg)) {
      svg = svg.replace("<svg", `<svg width="${width}" height="${height}"`);
    }
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const w = Math.max(img.naturalWidth || width, 200) * scale;
        const h = Math.max(img.naturalHeight || height, 200) * scale;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((png) => {
          URL.revokeObjectURL(url);
          if (!png) reject(new Error("PNG encode failed"));
          else resolve(png);
        }, "image/png");
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG image load failed"));
    };
    img.src = url;
  });
}

export function wrapSvg(inner, { width = 640, height = 360, className = "diagram-svg", maxWidth = 560 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" class="${className}" viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${maxWidth}px;height:auto;display:block;margin:0 auto;background:#fff;">
  ${inner}
</svg>`;
}
