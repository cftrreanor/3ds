import Link from "next/link";
import { setSignupKind, setStationShowing } from "../../../actions";
import { ActionButton } from "../forms";
import { EyeOffIcon } from "@/components/eye-off-icon";

export type JobLinks = { addJob: string; next: { href: string; label: string } };

export type JobVisibilityFacts = {
  showing: boolean;
  /** Its shifts (or things to bring): a job with none has nothing to sign up for yet. */
  ready: boolean;
  items: boolean;
  /** People signed up for it. */
  signedUp: number;
  /** The only job a published event's volunteers can see. */
  lastShowing: boolean;
  previewHref: string;
  /** The event is published: showing means volunteers see it now. */
  published: boolean;
  /** Ways on from the job's save bar (it's always in reach on a phone): another job, and the next step. */
  links: JobLinks;
};

/**
 * At the top of a volunteer event's job: whether volunteers can see it, and
 * the one button that changes that. When it can't change, it says why
 * (the database refuses the same cases).
 */
export function JobVisibility({ eventId, stationId, name, job }: { eventId: string; stationId: string; name: string; job: JobVisibilityFacts }) {
  if (!job.showing) {
    return (
      <div className="rounded-lg border border-warning/40 bg-warning-soft p-4 text-sm leading-6">
        <p className="flex items-center gap-2 font-semibold">
          <EyeOffIcon />
          Hidden: volunteers can&apos;t see this job
        </p>
        <p className="mt-1">
          Your hosts, Volunteer Leads, and this job&apos;s Coordinators can{" "}
          <Link href={job.previewHref} className="font-medium underline underline-offset-4">
            preview it
          </Link>
          .{" "}
          {job.ready ? (
            "When it's ready, choose Post job at the bottom."
          ) : (
            <>
              <a href="#build-shifts" className="font-medium underline underline-offset-4">
                {job.items ? "Add a thing to bring" : "Add a shift"}
              </a>
              , then post it.
            </>
          )}
        </p>
      </div>
    );
  }
  const blocked = job.signedUp
    ? `You can't hide this job while ${job.signedUp} ${job.signedUp === 1 ? "person is" : "people are"} signed up for it.`
    : job.lastShowing
      ? "This is the only job volunteers can see. Show another job before you hide this one, or unpublish the event."
      : null;
  return (
    <div className="rounded-lg border border-success/30 bg-success-soft p-4 text-sm leading-6">
      <p className="flex items-center gap-2 font-semibold">
        <span aria-hidden className="text-success">
          ✓
        </span>
        {job.published ? "Showing: volunteers can see this job" : "Showing: volunteers will see this job when you publish"}
      </p>
      {blocked ? (
        <p className="mt-1 text-muted">
          {blocked}
          {job.signedUp > 0 && (
            <>
              {" "}
              <a href="#signed-up" className="font-medium text-foreground underline underline-offset-4">
                See who
              </a>
            </>
          )}
        </p>
      ) : (
        <div className="mt-3">
          <ActionButton
            action={setStationShowing.bind(null, eventId, stationId, false)}
            variant="secondary"
            pendingText="Hiding…"
            confirmMessage={`Hide “${name}” from volunteers? It comes off the sign-up page until you show it again.`}
          >
            Hide this job
          </ActionButton>
        </div>
      )}
    </div>
  );
}

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
