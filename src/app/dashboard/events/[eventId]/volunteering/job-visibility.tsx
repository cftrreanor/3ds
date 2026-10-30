import Link from "next/link";
import { setStationShowing } from "../../../actions";
import { ActionButton } from "../forms";
import { EyeOffIcon } from "@/components/eye-off-icon";

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
          Hosts, Co-hosts, Volunteer Leads, and this job&apos;s Coordinators can{" "}
          <Link href={job.previewHref} className="font-medium underline underline-offset-4">
            preview it
          </Link>
          .
        </p>
        <div className="mt-3">
          {job.ready ? (
            <ActionButton action={setStationShowing.bind(null, eventId, stationId, true)} pendingText="Showing…">
              Show to volunteers
            </ActionButton>
          ) : (
            <p className="font-medium">{job.items ? "Add a thing to bring, then show it to volunteers" : "Add a shift, then show it to volunteers"}</p>
          )}
        </div>
      </div>
    );
  }
  const blocked = job.signedUp
    ? `You can't hide this job while ${job.signedUp} ${job.signedUp === 1 ? "person is" : "people are"} signed up for it. Move or remove them first.`
    : job.lastShowing
      ? "This is the only job volunteers can see. Show another job before you hide this one, or unpublish the event."
      : null;
  return (
    <div className="rounded-lg border border-success/30 bg-success-soft p-4 text-sm leading-6">
      <p className="flex items-center gap-2 font-semibold">
        <span aria-hidden className="text-success">
          ✓
        </span>
        Showing: volunteers can see this job
      </p>
      {blocked ? (
        <p className="mt-1 text-muted">{blocked}</p>
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
