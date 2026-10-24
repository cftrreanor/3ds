/** What people are told about their privacy (booking page and their own page): a child's, at conferences. */
export function PrivacyNote({
  teacher,
  weekly = false,
  meeting = false,
}: {
  teacher: string;
  /** Weekly hours: deleted 30 days after each meeting. */
  weekly?: boolean;
  /** Meetings: no child, and anyone books. */
  meeting?: boolean;
}) {
  return (
    <section aria-labelledby="privacy-heading" className="rounded-xl border border-border bg-brand-soft p-4 text-sm leading-6 sm:p-5">
      <h2 id="privacy-heading" className="text-base font-semibold">
        <span aria-hidden>🔒</span> {meeting ? "Your privacy" : <>Your child&apos;s privacy</>}
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>
          {meeting ? (
            <>
              Only <strong>{teacher}</strong> sees your names, contact details, and note.
            </>
          ) : (
            <>
              Only <strong>{teacher}</strong> sees your child&apos;s name, your names and contact details, and your note.
            </>
          )}
        </li>
        <li>Other {meeting ? "people" : "families"} only see which times are still open. They never see who booked, or when.</li>
        <li>Nothing about your booking appears on the public page.</li>
        <li>Everything is permanently deleted 30 days after {weekly || meeting ? "your meeting" : "the conference"}, or right away if you cancel.</li>
      </ul>
    </section>
  );
}
