"use client";

import { DIGEST_PARTS, type DigestPrefs } from "@/lib/notify-kinds";

/** Asked when someone saves their own summary with nothing ticked. */
export const DIGEST_OFF_CONFIRM = "Turn off your volunteer summary? With nothing ticked, you won't get any volunteer summary emails for this event.";

/** What a daily volunteer summary includes: a tick for new bookings, changes, and cancellations. */
export function DigestChoices({
  name,
  value,
  onChange,
  who,
}: {
  /** The form field each tick sends (its value is the part's key). */
  name: string;
  value: DigestPrefs;
  onChange: (next: DigestPrefs) => void;
  /** For screen readers: whose summary this is. */
  who?: string;
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1" role="group" aria-label={who ? `What ${who}'s summary includes` : "What your summary includes"}>
      {DIGEST_PARTS.map((p) => (
        <label key={p.key} className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name={name}
            value={p.key}
            checked={value[p.key]}
            onChange={(e) => onChange({ ...value, [p.key]: e.target.checked })}
            className="h-4 w-4 shrink-0 accent-[var(--brand)]"
          />
          {p.label}
        </label>
      ))}
    </div>
  );
}
