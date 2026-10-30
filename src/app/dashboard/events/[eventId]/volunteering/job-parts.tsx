import { setSignupKind } from "../../../actions";
import { ActionButton } from "../forms";

/** Ways on from a job's bar (always in reach on a phone): another job, a preview, and the next step. */
export type JobLinks = { addJob: string; preview: string; next: { href: string; label: string } };

/** What a volunteer event's job panel needs beyond the station itself. */
export type JobFacts = {
  /** It has a shift or a thing to bring (what volunteers sign up for). */
  ready: boolean;
  items: boolean;
  links: JobLinks;
};

/**
 * The top of a volunteer event's job: does it take shifts or things to bring? Switches straight
 * away while the job has neither; after that it says what it is and why it can't change.
 */
export function JobKindSwitch({
  eventId,
  stationId,
  kind,
  locked,
}: {
  eventId: string;
  stationId: string;
  kind: "shifts" | "items";
  locked: string | null;
}) {
  const choices = [
    { value: "shifts", label: "Shifts", hint: "People sign up for a time" },
    { value: "items", label: "Things to bring", hint: "People sign up to bring something" },
  ] as const;
  return (
    <div>
      <p id={`kind-${stationId}`} className="text-sm font-semibold">
        What do volunteers sign up for?
      </p>
      <div role="group" aria-labelledby={`kind-${stationId}`} className="mt-2 grid gap-2 sm:grid-cols-2">
        {choices.map((c) =>
          c.value === kind ? (
            <p key={c.value} aria-current="true" className="flex min-h-14 flex-col justify-center rounded-lg border-2 border-brand bg-brand-soft px-4 py-2">
              <span className="text-sm font-semibold">✓ {c.label}</span>
              <span className="text-xs text-muted">{c.hint}</span>
            </p>
          ) : locked ? null : (
            <ActionButton
              key={c.value}
              action={setSignupKind.bind(null, eventId, stationId, c.value)}
              variant="secondary"
              pendingText="Switching…"
              className="min-h-14! w-full flex-col items-start! justify-center"
            >
              <span className="text-sm font-semibold">{c.label}</span>
              <span className="text-xs font-normal text-muted">{c.hint}</span>
            </ActionButton>
          ),
        )}
      </div>
      {locked && <p className="mt-1.5 text-sm text-muted">{locked}</p>}
    </div>
  );
}
