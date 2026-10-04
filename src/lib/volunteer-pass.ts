import "server-only";
import { cookies } from "next/headers";

// "Remember this device" for volunteers: a private cookie holding the tokens
// that prove which shifts this browser may see and cancel. The database checks
// the tokens (pass_agenda / cancel_with_pass); the cookie alone grants nothing.
//   v: volunteer access tokens (from the emailed "View my shifts" link)
//   a: signup manage tokens (shifts booked from this browser)
//   e: public links (slugs) of events this browser volunteered for, so we can
//      offer "sign up for more" even after every shift is cancelled

const COOKIE = "fc_pass";
const MAX_TOKENS = 40;
const isUuid = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s);
const isSlug = (s: unknown): s is string => typeof s === "string" && /^[a-z0-9][a-z0-9-]{1,62}$/.test(s);

export type Pass = { v: string[]; a: string[]; e: string[] };

export async function readPass(): Promise<Pass> {
  try {
    const raw = (await cookies()).get(COOKIE)?.value;
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      v: Array.isArray(parsed.v) ? parsed.v.filter(isUuid) : [],
      a: Array.isArray(parsed.a) ? parsed.a.filter(isUuid) : [],
      e: Array.isArray(parsed.e) ? parsed.e.filter(isSlug) : [],
    };
  } catch {
    return { v: [], a: [], e: [] };
  }
}

/** Add tokens to this browser's pass. Only call from Server Actions and Route Handlers. */
export async function addToPass(add: Partial<Pass>) {
  const current = await readPass();
  const merge = (old: string[], extra: string[] = [], valid: (s: unknown) => s is string = isUuid) =>
    [...new Set([...extra.filter(valid), ...old])].slice(0, MAX_TOKENS);
  const next = { v: merge(current.v, add.v), a: merge(current.a, add.a), e: merge(current.e, add.e, isSlug) };
  (await cookies()).set(COOKIE, JSON.stringify(next), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
}

export async function forgetPass() {
  (await cookies()).delete(COOKIE);
}

export function hasPass(pass: Pass) {
  return pass.v.length > 0 || pass.a.length > 0;
}
