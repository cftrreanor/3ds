/**
 * Send a file straight to storage with a one-time upload link our server made
 * (createSignedUploadUrl). The link carries its own permission, so the
 * browser needs no Supabase keys or sign-in for this.
 */
export async function uploadToSignedUrl(signedUrl: string, file: File): Promise<boolean> {
  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", file);
  try {
    const res = await fetch(signedUrl, { method: "PUT", body, headers: { "x-upsert": "false" } });
    return res.ok;
  } catch {
    return false;
  }
}
