/**
 * Where to send someone after signing in or out: only a path on this site.
 * "/dashboard" passes; "//evil.com", "/\evil.com" and "/<tab>/evil.com" don't
 * (browsers treat a backslash like a slash and drop tabs and newlines, so
 * those would leave the site). Returns the path, or null.
 */
export function safeNext(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return null;
  const base = "https://site.invalid";
  const url = new URL(raw, base);
  return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : null;
}
