// The emails the app sends on its own whose wording an admin can change
// (20261227000000_system_emails.sql). Each one's subject, heading, message and
// button text can be replaced from /admin/emails; links, times, calendar
// invites and the footer stay in the code. With nothing saved, the code's
// built-in wording goes out unchanged. Client-safe: the editor uses it too.

export type SystemEmailField = { key: string; label: string; sample: string };

export type SystemEmailText = {
  subject: string;
  heading: string;
  /** Paragraphs, separated by a blank line. */
  body: string;
  /** Blank: the built-in button text. */
  button_label: string | null;
};

export type SystemEmail = {
  key: string;
  group: string;
  name: string;
  /** Who gets it and when, in plain words. */
  description: string;
  fields: SystemEmailField[];
  /** Fields the email can't go out without (somewhere in the subject, heading or message). */
  required: string[];
  /** The built-in wording, written with fields. */
  starting: SystemEmailText & { button_label: string | null };
  /** Lines the code always adds after the message (shown in the preview, not editable). */
  locked: string[];
};

const inviteFields: SystemEmailField[] = [
  { key: "inviter", label: "Who invited them (name and organization)", sample: "Jordan Lee from Lakeside HS Band Boosters" },
  { key: "organization", label: "Organization", sample: "Lakeside HS Band Boosters" },
  { key: "event_name", label: "Event name", sample: "Lakeside Marching Classic" },
  { key: "event_when", label: "Event dates and venue", sample: "Oct 24, 2026 at Lakeside Stadium" },
  { key: "event_day", label: "The big day (contest day or the event day)", sample: "contest day" },
];
const inviteLocked = [
  "Tap the button to accept. There's no password: it signs you in as {their email}, and sets up your account if you don't have one yet.",
];

const bookingFields: SystemEmailField[] = [
  { key: "who", label: "Family or person who booked", sample: "The Rivera family (Sam Rivera)" },
  { key: "when", label: "Meeting date and time", sample: "Tue, Nov 3, 4:10–4:25 PM" },
  { key: "kind", label: "conference or meeting", sample: "conference" },
  { key: "event_name", label: "Event name", sample: "Fall conferences" },
];

export const SYSTEM_EMAILS: SystemEmail[] = [
  {
    key: "host_invitation",
    group: "Hosts",
    name: "Host invitation",
    description: "Goes to a new host when you invite them from the pipeline without picking an email template.",
    fields: [
      { key: "first_name", label: "Their first name", sample: "Jordan" },
      { key: "name", label: "Their full name", sample: "Jordan Lee" },
      { key: "email", label: "Their email address", sample: "jordan@example.com" },
      { key: "organization", label: "Organization", sample: "Lakeside HS Band Boosters" },
      { key: "plan", label: "Package and free period", sample: "Schedule Command (free pilot)" },
      { key: "free_until", label: "Last free day", sample: "Jan 1, 2027" },
    ],
    required: ["email"],
    starting: {
      subject: "Your {{brand}} host invitation",
      heading: "You're invited to host on {{brand}}",
      body: "Hi {{first_name}}. Your pilot spot is ready. Sign in with this email address ({{email}}) to set up your organization and create your first event.\n\nThere's no password to remember: we'll email you a sign-in link. The invitation works for 30 days.",
      button_label: "Set up my organization",
    },
    locked: [],
  },
  {
    key: "team_invite_cohost",
    group: "Team invitations",
    name: "Co-host invitation",
    description: "Goes to someone a host invites to co-host their events.",
    fields: [
      ...inviteFields,
      { key: "access", label: "What co-hosts can do", sample: "bands, the schedule, volunteers, the team, and contest day" },
    ],
    required: [],
    starting: {
      subject: "You're invited to co-host {{organization}} on {{brand}}",
      heading: "Co-host events for {{organization}}",
      body: "{{inviter}} invited you to co-host their events on {{brand}}, starting with {{event_name}} ({{event_when}}).\n\nCo-hosts have the same access as the host on every event: {{access}}.",
      button_label: "Accept invitation",
    },
    locked: inviteLocked,
  },
  {
    key: "team_invite_volunteer_lead",
    group: "Team invitations",
    name: "Volunteer Lead invitation",
    description: "Goes to someone a host invites to help run volunteers for an event.",
    fields: inviteFields,
    required: [],
    starting: {
      subject: "Help run volunteers for {{event_name}}",
      heading: "You're invited to be a Volunteer Lead",
      body: "{{inviter}} invited you to help run volunteers for {{event_name}} ({{event_when}}).\n\nAs a Volunteer Lead you'll set up stations and shifts, see who's signed up, check people in, and help run {{event_day}}.",
      button_label: "Accept invitation",
    },
    locked: inviteLocked,
  },
  {
    key: "team_invite_section_lead",
    group: "Team invitations",
    name: "Section Lead invitation",
    description: "Goes to someone a host asks to lead one station (called Station Coordinator at fairs).",
    fields: [
      ...inviteFields,
      { key: "station", label: "Their station", sample: "Concessions" },
      { key: "lead_title", label: "Section Lead or Station Coordinator", sample: "Section Lead" },
    ],
    required: [],
    starting: {
      subject: "Lead {{station}} at {{event_name}}",
      heading: "You're invited to be a {{lead_title}}",
      body: "{{inviter}} asked you to lead {{station}} at {{event_name}} ({{event_when}}).\n\nYou'll see who's on your station's shifts, and their phone numbers unlock on {{event_day}}.",
      button_label: "Accept invitation",
    },
    locked: inviteLocked,
  },
  {
    key: "organizer_booking_booked",
    group: "Conferences and meetings",
    name: "New booking",
    description: "Goes to the organizer when a family or guest books a conference or meeting. A calendar invite is attached.",
    fields: bookingFields,
    required: ["when"],
    starting: {
      subject: "New {{kind}} booked: {{when}}",
      heading: "A family booked a {{kind}}",
      body: "{{who}} booked a {{kind}} with you ({{event_name}}). A calendar invite is attached, so it's on your calendar.\n\nAfter the meeting, mark it Met or No-show on your Meetings page, so your records are complete.",
      button_label: "Open your Meetings page",
    },
    locked: ["Then: when, where, and who's coming"],
  },
  {
    key: "organizer_booking_changed",
    group: "Conferences and meetings",
    name: "Changed booking",
    description: "Goes to the organizer when a family or guest changes their booking. The calendar invite is updated.",
    fields: bookingFields,
    required: ["when"],
    starting: {
      subject: "{{Kind}} changed: {{when}}",
      heading: "A family changed their {{kind}}",
      body: "{{who}} changed their {{kind}}. The details below are current, and your calendar invite is updated.\n\nAfter the meeting, mark it Met or No-show on your Meetings page, so your records are complete.",
      button_label: "Open your Meetings page",
    },
    locked: ["Then: when, where, and who's coming"],
  },
  {
    key: "organizer_booking_canceled",
    group: "Conferences and meetings",
    name: "Canceled booking",
    description: "Goes to the organizer when a family or guest cancels. It takes the meeting off their calendar.",
    fields: bookingFields,
    required: ["when"],
    starting: {
      subject: "Canceled {{kind}}: {{when}}",
      heading: "A family canceled their {{kind}}",
      body: "{{who}} canceled their {{kind}} ({{when}}). The time is open again.",
      button_label: "Open your Meetings page",
    },
    locked: ["This email takes it off your calendar (in Gmail, you may need to open it first)."],
  },
  {
    key: "band_withdrew",
    group: "Band contests",
    name: "A band withdrew",
    description: "Goes to the organizer when a director withdraws their band or group.",
    fields: [
      { key: "band_name", label: "Band or group name", sample: "Lakeside HS Marching Band" },
      { key: "school", label: "School", sample: "Lakeside High School" },
      { key: "event_name", label: "Event name", sample: "Lakeside Marching Classic" },
    ],
    required: ["band_name"],
    starting: {
      subject: "{{band_name}} withdrew from {{event_name}}",
      heading: "{{band_name}} withdrew",
      body: "{{band_name}} ({{school}}) withdrew from {{event_name}}.",
      button_label: "See your bands",
    },
    locked: ["Then what happened: their registration was removed, or they're marked withdrawn on your schedule"],
  },
];

export const systemEmail = (key: string) => SYSTEM_EMAILS.find((e) => e.key === key);

/** Fields every email has. */
export const COMMON_FIELDS: SystemEmailField[] = [{ key: "brand", label: "Our product name", sample: "" }];

const FIELD = /\{\{\s*([A-Za-z_]+)\s*\}\}/g;

/** The fields an email knows, with {{Kind}}-style capitalized versions allowed for any field. */
function known(email: SystemEmail, key: string) {
  const k = key[0].toLowerCase() + key.slice(1);
  return k === "brand" || email.fields.some((f) => f.key === k);
}

/** Fill {{fields}}. {{Field}} with a capital letter capitalizes the value. Unknown fields stay as typed. */
export function fillSystemText(email: SystemEmail, text: string, vars: Record<string, string>) {
  return text.replace(FIELD, (whole, key: string) => {
    if (!known(email, key)) return whole;
    const k = key[0].toLowerCase() + key.slice(1);
    const v = vars[k] ?? "";
    return key[0] !== k[0] && v ? v[0].toUpperCase() + v.slice(1) : v;
  });
}

/** What's wrong with an edited version, or null. */
export function checkSystemText(email: SystemEmail, t: SystemEmailText): string | null {
  if (!t.subject.trim()) return "Add a subject.";
  if (!t.heading.trim()) return "Add a heading.";
  if (!t.body.trim()) return "Write the message.";
  if (t.subject.length > 300 || t.heading.length > 200 || t.body.length > 5000) return "That's too long.";
  if ((t.button_label ?? "").length > 60) return "Keep the button text under 60 characters.";
  const all = `${t.subject}\n${t.heading}\n${t.body}\n${t.button_label ?? ""}`;
  const unknown = [...all.matchAll(FIELD)].map((m) => m[1]).filter((k) => !known(email, k));
  if (unknown.length) return `This email doesn't have ${[...new Set(unknown)].map((k) => `{{${k}}}`).join(", ")}. Use the fields listed under the editor.`;
  const used = new Set([...all.matchAll(FIELD)].map((m) => m[1].toLowerCase()));
  const missing = email.required.filter((k) => !used.has(k));
  if (missing.length) return `Keep ${missing.map((k) => `{{${k}}}`).join(", ")} in the email: people need it.`;
  return null;
}

/** The finished words: the saved version filled in, as emailLayout takes them. */
export function systemEmailWords(email: SystemEmail, t: SystemEmailText, vars: Record<string, string>) {
  const fill = (s: string) => fillSystemText(email, s, vars).replace(/[ \t]+/g, " ").trim();
  return {
    subject: fill(t.subject),
    heading: fill(t.heading),
    paragraphs: t.body
      .replace(/\r\n/g, "\n")
      .split(/\n\s*\n/)
      .map(fill)
      .filter(Boolean),
    button: t.button_label ? fill(t.button_label) : null,
  };
}

/** Sample values for the preview and the test email. */
export const sampleVars = (email: SystemEmail, brandName: string) => ({
  brand: brandName,
  ...Object.fromEntries(email.fields.map((f) => [f.key, f.sample])),
});
