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
};

export type SetupFacts = {
  eventId: string;
  eventType: string;
  published: boolean;
  stations: number;
  shifts: number;
  /** Stations marked as check-in stops (band contests). */
  checkInStops: number;
  team: number;
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
  booths: number;
  parentRegistrationOpen: boolean;
  parentClosesAt: boolean;
  /** Conferences: what's still needed before publishing (null when ready). */
  conferenceMissing?: string | null;
};

export type SetupChecklist = {
  before: SetupStep[];
  publish: SetupStep;
  after: SetupStep[];
  /** Recommended steps still to do before publishing. */
  remaining: SetupStep[];
  doneCount: number;
  total: number;
};

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
      },
      {
        id: "team",
        label: "Invite your team",
        hint: "Co-hosts and leads who help you run the day.",
        href: `${base}/team`,
        done: f.team > 0,
        required: false,
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

  const all = [...before, publish, ...after];
  return {
    before,
    publish,
    after,
    remaining: before.filter((s) => s.required && !s.done),
    doneCount: all.filter((s) => s.done).length,
    total: all.length,
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
