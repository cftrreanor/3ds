/** What families are told about their child's privacy (booking page and their own page). */
export function PrivacyNote({ teacher, weekly = false }: { teacher: string; /** Weekly hours: deleted 30 days after each meeting. */ weekly?: boolean }) {
  return (
    <section aria-labelledby="privacy-heading" className="rounded-xl border border-border bg-brand-soft p-4 text-sm leading-6 sm:p-5">
      <h2 id="privacy-heading" className="text-base font-semibold">
        🔒 Your child&apos;s privacy
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>
          Only <strong>{teacher}</strong> sees your child&apos;s name, your names and contact details, and your note.
        </li>
        <li>Other families only see which times are still open. They never see who booked, or when.</li>
        <li>Nothing about your booking appears on the public page.</li>
        <li>Everything is permanently deleted 30 days after {weekly ? "your meeting" : "the conference"}, or right away if you cancel.</li>
      </ul>
    </section>
  );
}
