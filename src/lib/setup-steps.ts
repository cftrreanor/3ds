/**
 * The setup steps of an event before it's published, shared by the server layout (which pages hide
 * the setup strip) and the steps along the top (a client component).
 */

/** Each kind of event's setup steps, and where each one lives under the event. */
export const SETUP_STEPS = {
  volunteer: [
    { key: "details", label: "Details", path: "/edit" },
    { key: "jobs", label: "Jobs and shifts", path: "/volunteering" },
    { key: "publish", label: "Publish", path: "" },
  ],
  band: [
    { key: "details", label: "Details", path: "/edit" },
    { key: "registration", label: "Registration", path: "/bands" },
    { key: "publish", label: "Publish", path: "" },
  ],
} as const;
export type StepsKind = keyof typeof SETUP_STEPS;

/** The pages that show the steps (every other page keeps the setup strip). */
export const STEP_PATHS: Record<StepsKind, string[]> = {
  volunteer: SETUP_STEPS.volunteer.map((s) => s.path),
  band: SETUP_STEPS.band.map((s) => s.path),
};

export type SetupStepFacts = {
  /** The middle step is done (a job volunteers can see; what directors need to register). */
  middleDone: boolean;
  /** What the middle step still needs, when it isn't done ("Litter pickup needs a shift"). */
  middleNote: string | null;
  /** Shown beside the middle step's name ("3 jobs"). */
  count: string | null;
};

