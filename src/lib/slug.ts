/** "Pflugerville Band Boosters" → "pflugerville-band-boosters-x7k2" */
export function slugify(name: string, withSuffix = true) {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "event";
  if (!withSuffix) return base.length >= 2 ? base : `${base}-1`;
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}
