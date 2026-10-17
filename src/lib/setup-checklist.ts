import { groupWords, hasBooths, hasConferences, hasEnsembles, hasParents, hasRooms } from "@/lib/event-types";

/**
 * The host's setup checklist for one event: what to do before publishing,
 * the publish step itself, and what to open once it's live. Each step is
 * ticked from the event's real data, so it can't drift from what's set up.
 */
export type SetupStep = {
  id: string;
  label: string;
  /** One line on why, or what "done" means. */
  hint: string;
  href: string;
  done: boolean;
  /** Recommended before publishing (otherwise optional). */
  required: boolean;
  /** Started but not finished (something's saved): how far along, and what's there so far. */
  partial?: { fraction: number; note: string };
};

export type SetupFacts = {
  eventId: string;
  eventType: string;
  published: boolean;
  stations: number;
  shifts: number;
  /** Stations marked as check-in stops (band contests). */
  checkInStops: number;
  /** People who've joined the event's team (co-hosts and leads). */
  team: number;
  /** Team invitations sent but not accepted yet. */
  invitesPending: number;
  files: number;
  volunteerSignupOpen: boolean;
  bandRegistrationOpen: boolean;
  scheduleShared: boolean;
  /** Band contests: finals times exist, are published, and finalist names are revealed. */
  finalsSlots: number;
  finalsPublished: boolean;
  finalistsRevealed: boolean;
  directorInfo: boolean;
  pathRooms: number;
  /** Group events: every room, on the path or not. */
  rooms: number;
  /** Performance (or room) times built, published or not. */
  scheduleSlots: number;
  /** Conferences: meeting times saved (the place may still be missing). */
  conferenceTimesSaved?: boolean;
  booths: number;
  parentRegistrationOpen: boolean;
  parentClosesAt: boolean;
  /** Conferences: what's still needed before publishing (null when ready). */
  conferenceMissing?: string | null;
};

export type SetupChecklist = {
  eventId: string;
  before: SetupStep[];
  publish: SetupStep;
  after: SetupStep[];
  /** Recommended steps still to do before publishing. */
  remaining: SetupStep[];
  doneCount: number;
  total: number;
  /** The one step to do next (none when everything's done). */
  next: SetupStep | null;
  /** A step that's started but not finished: where to pick up after stepping away. */
  inProgress: SetupStep | null;
  /** One segment per counted step, for the progress line. */
  segments: { id: string; state: "done" | "partial" | "todo"; fraction: number }[];
  /**
   * What the progress line counts: before publishing, only what's needed to
   * publish; once live, the steps that come after. Optional steps never count.
   */
  progress: { label: string; done: number; of: number };
  /** Live, and every after-publish step done: the checklist can step aside. */
  complete: boolean;
};

// Same order as the sections on the event page: what people sign up for, the schedule, volunteers, the day, team, maps.
const BEFORE_ORDER = ["details", "director-info", "booths", "conference", "parents-close", "rooms", "shifts", "check-in", "team", "files"];

export function setupChecklist(f: SetupFacts): SetupChecklist {
  const base = `/dashboard/events/${f.eventId}`;
  const groups = hasEnsembles(f.eventType);
  const words = groupWords(f.eventType);
  const volunteerEvent = f.eventType === "volunteer";
  const hasShifts = f.stations > 0 && f.shifts > 0;

  const before: SetupStep[] = [
    {
      id: "details",
      label: "Add the date, time, and place",
      hint: "Shown on your public page. You can change them later.",
      href: `${base}/edit`,
      done: true,
      required: true,
    },
  ];
  if (hasRooms(f.eventType)) {
    before.push({
      id: "rooms",
      label: "Add rooms and the path groups follow",
      hint: "The schedule is built from your rooms.",
      href: `${base}/rooms#rooms-heading`,
      done: f.pathRooms > 0,
      required: true,
      partial: f.rooms > 0 ? { fraction: 0.5, note: `${f.rooms} room${f.rooms === 1 ? "" : "s"}, path not set yet` } : undefined,
    });
  }
  if (f.eventType === "band_contest") {
    before.push(
      {
        id: "director-info",
        label: "Add information for directors",
        hint: "Entry fee, arrival, parking: shown when bands register.",
        href: `${base}/bands`,
        done: f.directorInfo,
        required: false,
      },
      {
        id: "check-in",
        label: "Set your contest day check-in stops",
        hint: "Like Parking, Check-in, and the Gate.",
        href: `${base}/volunteering`,
        done: f.checkInStops > 0,
        required: false,
      },
    );
  }
  if (hasBooths(f.eventType)) {
    before.push({
      id: "booths",
      label: "Add booths and partners",
      hint: "Booths you list publicly appear on your event page.",
      href: `${base}/booths`,
      done: f.booths > 0,
      required: true,
    });
  }
  if (hasConferences(f.eventType)) {
    before.push({
      id: "conference",
      label: "Set meeting times and where you'll meet",
      hint: f.conferenceMissing ?? "Your meetings, and your room or video link.",
      href: `${base}/conferences`,
      done: !f.conferenceMissing,
      required: true,
      partial: f.conferenceTimesSaved && f.conferenceMissing ? { fraction: 0.5, note: "Meeting times saved" } : undefined,
    });
  }
  if (hasParents(f.eventType)) {
    before.push({
      id: "parents-close",
      label: "Choose when parent registration closes",
      hint: "Or close it by hand when you're ready.",
      href: `${base}/parents`,
      done: f.parentClosesAt,
      required: false,
    });
  }
  // A teacher's conference is just them: no volunteers, team or documents.
  if (!hasConferences(f.eventType)) {
    before.push(
      {
        id: "shifts",
        label: "Add volunteer stations and shifts",
        hint: volunteerEvent ? "What volunteers sign up for." : "Only if you need volunteers.",
        href: `${base}/volunteering`,
        done: hasShifts,
        required: volunteerEvent,
        partial: f.stations > 0 ? { fraction: 0.5, note: `${f.stations} station${f.stations === 1 ? "" : "s"}, no shifts yet` } : undefined,
      },
      {
        id: "team",
        label: "Invite your team",
        hint: "Co-hosts and leads who help you run the day.",
        href: `${base}/team`,
        done: f.team > 0,
        required: false,
        partial:
          f.invitesPending > 0
            ? { fraction: 0.5, note: `${f.invitesPending} invitation${f.invitesPending === 1 ? "" : "s"} waiting to be accepted` }
            : undefined,
      },
      {
        id: "files",
        label: "Add maps or documents",
        hint: "Parking maps, packets, schedules.",
        href: `${base}/edit?step=files`,
        done: f.files > 0,
        required: false,
      },
    );
  }

  const publish: SetupStep = {
    id: "publish",
    label: "Publish your event",
    hint: "Puts your public page online. You can unpublish anytime.",
    href: `${base}#publish`,
    done: f.published,
    required: true,
  };

  const after: SetupStep[] = [];
  if ((hasShifts || volunteerEvent) && !hasConferences(f.eventType)) {
    after.push({
      id: "signup",
      label: "Open volunteer sign-up",
      hint: "Then share the sign-up link or QR code.",
      href: `${base}/volunteering`,
      done: f.published && f.volunteerSignupOpen,
      required: false,
    });
  }
  if (groups) {
    after.push(
      {
        id: "registration",
        label: `Open ${words.one} registration`,
        hint: `So ${words.one} directors can register.`,
        href: `${base}/bands`,
        done: f.published && f.bandRegistrationOpen,
        required: false,
      },
      {
        id: "schedule",
        label: hasRooms(f.eventType) ? "Build and post the room schedule" : "Build and publish the performance schedule",
        hint: "Directors are emailed their times when you publish it.",
        href: hasRooms(f.eventType) ? `${base}/rooms#order-heading` : `${base}/schedule`,
        done: f.scheduleShared,
        required: false,
        partial: f.scheduleSlots > 0 ? { fraction: 0.75, note: "Built, not published yet" } : undefined,
      },
    );
  }
  if (hasParents(f.eventType)) {
    after.push({
      id: "parents-open",
      label: "Open parent registration",
      hint: "Share the registration link or QR code with families.",
      href: `${base}/parents`,
      done: f.published && f.parentRegistrationOpen,
      required: false,
    });
  }

  before.sort((a, b) => BEFORE_ORDER.indexOf(a.id) - BEFORE_ORDER.indexOf(b.id));
  // Only open steps can be part-way; a finished one just shows done.
  for (const st of [...before, ...after]) if (st.done) delete st.partial;
  const all = [...before, publish, ...after];
  const remaining = before.filter((s) => s.required && !s.done);
  const needed = [...before.filter((s) => s.required), publish];
  const afterDone = after.filter((s) => s.done).length;
  const next = !f.published ? (remaining[0] ?? publish) : (after.find((s) => !s.done) ?? null);
  const counted = f.published ? after : needed;
  const inProgress = (f.published ? after : [...before, ...after]).find((s) => !s.done && s.partial) ?? null;
  return {
    eventId: f.eventId,
    inProgress,
    segments: counted.map((s) => ({
      id: s.id,
      state: s.done ? "done" : s.partial ? "partial" : "todo",
      fraction: s.done ? 1 : (s.partial?.fraction ?? 0),
    })),
    before,
    publish,
    after,
    remaining,
    doneCount: all.filter((s) => s.done).length,
    total: all.length,
    next,
    progress: f.published
      ? { label: after.length ? `Live · ${afterDone} of ${after.length} done` : "Live", done: afterDone, of: after.length || 1 }
      : remaining.length
        ? {
            label: `${needed.filter((s) => s.done).length} of ${needed.length} needed to publish`,
            done: needed.filter((s) => s.done).length,
            of: needed.length,
          }
        : // Everything needed is in place: a full line, with Publish as the next step.
          { label: "Ready to publish", done: 1, of: 1 },
    complete: f.published && afterDone === after.length,
  };
}

/** What publishing changes for this event, in plain words (shown next to the Publish button). */
export function publishEffects(f: SetupFacts): string[] {
  const words = groupWords(f.eventType);
  const lines = ["Your public page goes online, so anyone with the link can see it."];
  if (hasConferences(f.eventType)) {
    return [
      ...lines,
      "Free: you can have one published conference at a time. To publish another, unpublish this one first.",
      "Nobody is emailed or notified. Families only find out when you share your link.",
      "You can keep editing everything, and unpublish at any time.",
    ];
  }
  if (f.stations > 0 || f.eventType === "volunteer") {
    lines.push(
      f.volunteerSignupOpen
        ? "Volunteer sign-up opens right away (it was left on)."
        : "Volunteer sign-up stays closed until you open it.",
    );
  }
  if (hasEnsembles(f.eventType)) {
    lines.push(
      f.bandRegistrationOpen
        ? `${words.One} registration opens right away (it was left on).`
        : `${words.One} registration stays closed until you open it.`,
    );
  }
  if (hasParents(f.eventType)) {
    lines.push(
      f.parentRegistrationOpen
        ? "Parents can start registering right away."
        : "Parent registration stays closed until you open it.",
    );
  }
  if (hasBooths(f.eventType)) lines.push("Booths you've listed publicly appear on your event page.");
  lines.push("Nobody is emailed or notified. People only find out when you share your link.");
  lines.push("You can keep editing everything, and unpublish at any time.");
  return lines;
}
