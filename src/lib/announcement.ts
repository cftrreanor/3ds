/**
 * The event's details as plain text, ready to paste into a flyer, a
 * newsletter, or a post: name, when, where, what's involved, and the link.
 */
export function announcementText({
  name,
  when,
  where,
  involved,
  url,
}: {
  name: string;
  /** "Saturday, March 14, 2027 · 8:00 AM–5:00 PM" */
  when: string;
  /** The venue's name and address, if it has one. */
  where: string | null;
  /** One line for each thing people can do (only the pages that are open). */
  involved: string[];
  url: string;
}): string {
  const lines = [name, when];
  if (where) lines.push(where);
  if (involved.length) lines.push("", "What's involved:", ...involved.map((line) => `• ${line}`));
  lines.push("", `Details and sign-up: ${url}`);
  return lines.join("\n");
}
