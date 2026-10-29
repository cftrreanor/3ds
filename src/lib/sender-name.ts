import { brand } from "./brand";

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * The name an event's emails show as from, before " via Field Command Events":
 * the person first (all a phone shows), then who they're with, e.g. "Becca
 * Smith, Cedar Ridge Band Boosters". A teacher's account is named for them, so
 * their school goes after the name instead. Either half alone when the other
 * is missing or says the same thing; nothing at all when it would just repeat
 * our own name (lib/email.ts then sends as us).
 */
export function senderName({
  person,
  organization,
  school,
}: {
  person?: string | null;
  organization?: string | null;
  /** Teacher accounts: their school, shown in place of the account's name. */
  school?: string | null;
}): string {
  const who = person?.trim() ?? "";
  const group = (school?.trim() || organization?.trim()) ?? "";
  const parts = [who, group && !(who && same(who, group)) ? group : ""].filter((p) => p && !same(p, brand.name));
  return parts.join(", ");
}
