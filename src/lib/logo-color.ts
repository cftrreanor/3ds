import { contrast, rgbToHex } from "@/lib/brand-color";

/**
 * The logo's main color, read in the browser: the most common colorful shade,
 * chosen over black and gray (a color has to cover at least 2% of the logo,
 * so a tiny detail doesn't decide it). When that shade is too light for white
 * text (a yellow), a strong second color that works is used instead (the navy
 * in a navy-and-gold logo), so the band isn't a muddy, darkened yellow. A
 * black-and-white logo gets its dark shade, usually black. Null for an image
 * with nothing but white.
 */
export function logoColor(img: HTMLImageElement): string | null {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const buckets = new Map<string, { r: number; g: number; b: number; n: number }>();
  const neutral = { r: 0, g: 0, b: 0, n: 0 };
  let opaque = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 128) continue;
    opaque += 1;
    const max = Math.max(r, g, b);
    const saturation = max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
    // Black and gray are the fallback; white is the paper.
    if (max < 30 || saturation < 0.25) {
      if (max < 200) {
        neutral.r += r;
        neutral.g += g;
        neutral.b += b;
        neutral.n += 1;
      }
      continue;
    }
    const key = `${r >> 5},${g >> 5},${b >> 5}`;
    const s = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    s.r += r;
    s.g += g;
    s.b += b;
    s.n += 1;
    buckets.set(key, s);
  }
  const avg = (s: { r: number; g: number; b: number; n: number }) => [s.r / s.n, s.g / s.n, s.b / s.n] as [number, number, number];
  const colors = [...buckets.values()].filter((s) => s.n >= opaque * 0.02).sort((a, b) => b.n - a.n);
  const top = colors[0];
  if (!top) return neutral.n ? rgbToHex(avg(neutral)) : null;
  const readable = (s: typeof top) => contrast(avg(s), [255, 255, 255]) >= 4.5;
  const second = readable(top) ? null : colors.find((s) => s.n >= top.n * 0.2 && readable(s));
  return rgbToHex(avg(second ?? top));
}

/** Load an image (a data URL or a picked file) and read its main color. */
export function colorOf(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(logoColor(img));
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
