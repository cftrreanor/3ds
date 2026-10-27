import { hasConferences, hasEnsembles, groupWords } from "@/lib/event-types";

/** The kinds of email an event sends its organizers (20261230000000_notification_recipients.sql). */
export type NotifyKind = "bookings" | "band_registered" | "band_withdrew" | "volunteer_digest";

/** The most other addresses an event's notifications can go to (the database checks too). */
export const MAX_EXTRA_EMAILS = 5;

/** Each kind this event sends, with how it reads in Email settings. */
export function notifyKinds(eventType: string | null | undefined): { kind: NotifyKind; label: string; hint: string }[] {
  if (hasConferences(eventType)) {
    return [{ kind: "bookings", label: "Bookings", hint: "Each booking, change, and cancellation, with a calendar invite" }];
  }
  const w = groupWords(eventType);
  return [
    ...(hasEnsembles(eventType)
      ? [
          { kind: "band_registered" as const, label: `${w.One} registrations`, hint: `When a ${w.one} registers` },
          { kind: "band_withdrew" as const, label: `${w.One} withdrawals`, hint: `When a ${w.one} withdraws` },
        ]
      : []),
    { kind: "volunteer_digest", label: "Volunteer sign-ups", hint: "A daily summary of new sign-ups and cancellations, on days with changes" },
  ];
}
