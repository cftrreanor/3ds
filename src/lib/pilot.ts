import { EVENT_TYPES } from "@/lib/event-types";
import { normalizePhone } from "@/lib/phone";

/** The event types a pilot request can ask about (the five kinds, plus "something else"). */
export const PILOT_EVENT_TYPES = [
  ...EVENT_TYPES.map((t) => ({ value: t.value as string, label: t.label, icon: t.icon as string })),
  { value: "other", label: "Something else", icon: "✨" },
];

export const pilotEventTypeLabels = (values: readonly string[] | null | undefined) =>
  (values ?? []).map((v) => PILOT_EVENT_TYPES.find((t) => t.value === v)?.label ?? v);

/** A pilot request's answers, checked and tidied. */
export type PilotRequest = {
  name: string;
  email: string;
  phone: string;
  organization: string;
  eventTypes: string[];
  notes: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Checks every answer on the "Request a pilot spot" form at once, so the
 * browser can point at each problem before sending and the server can
 * check again. `fieldErrors` is keyed by the input's name.
 */
export function checkPilotRequest(form: FormData): { request?: PilotRequest; fieldErrors: Record<string, string> } {
  const text = (k: string) => String(form.get(k) ?? "").trim();
  const name = text("name");
  const email = text("email").toLowerCase();
  const organization = text("organization");
  const notes = text("notes");
  const phone = normalizePhone(text("phone"));
  const known = new Set(PILOT_EVENT_TYPES.map((t) => t.value));
  const eventTypes = [...new Set(form.getAll("eventTypes").map(String))].filter((v) => known.has(v));

  const fieldErrors: Record<string, string> = {};
  if (name.length < 2) fieldErrors.name = "Please enter your name.";
  else if (name.length > 200) fieldErrors.name = "Please keep your name under 200 characters.";
  if (!EMAIL.test(email) || email.length > 254) fieldErrors.email = "Please enter a valid email address, like name@school.org.";
  if (!phone) fieldErrors.phone = "Please enter a 10-digit phone number, including the area code.";
  if (organization.length < 2) fieldErrors.organization = "Please enter your school or organization.";
  else if (organization.length > 200) fieldErrors.organization = "Please keep this under 200 characters.";
  if (!eventTypes.length) fieldErrors.eventTypes = "Please pick at least one kind of event.";
  if (notes.length > 2000) fieldErrors.notes = "Please keep your answer under 2,000 characters.";

  if (Object.keys(fieldErrors).length || !phone) return { fieldErrors };
  return { request: { name, email, phone, organization, eventTypes, notes }, fieldErrors };
}
