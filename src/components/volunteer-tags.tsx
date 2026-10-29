/** "Under 18" and, when their parent or guardian confirmed at sign-up, "Guardian confirmed". */
export function VolunteerTags({ minor, guardianConfirmed }: { minor?: boolean; guardianConfirmed?: boolean }) {
  if (!minor) return null;
  return (
    <>
      <span className="ml-2 rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold ring-1 ring-border">Under 18</span>
      {guardianConfirmed && (
        <span className="ml-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">✓ Guardian confirmed</span>
      )}
    </>
  );
}
