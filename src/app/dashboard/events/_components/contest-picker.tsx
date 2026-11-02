"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { confirmDialog } from "@/components/confirm-dialog";
import { Field, Select } from "@/components/ui";

export type PastContest = { id: string; name: string; date: string; venue: string | null };

/**
 * "Start from a previous contest": a dropdown of the account's earlier band contests, then a button to
 * use the one picked (choosing alone changes nothing, so arrowing through the list is safe). Using one
 * fills in its name, times, and venue; a date already typed is kept, and anything else typed is only
 * replaced after asking.
 */
/** The details form's fields this fills in, and how to name them when asking before replacing one. */
const FIELDS: [string, string][] = [
  ["name", "the event name"],
  ["endsOn", "the end date"],
  ["startTime", "the start time"],
  ["endTime", "the end time"],
  ["timezone", "the time zone"],
  ["venueName", "the venue name"],
  ["venueAddress", "the venue address"],
];

const detailsForm = () => document.querySelector<HTMLInputElement>('input[name="eventType"]')?.form ?? null;
const fieldValue = (form: HTMLFormElement | null, name: string) =>
  (form?.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)?.value ?? "").trim();
const list = (items: string[]) => (items.length > 2 ? `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}` : items.join(" and "));

export function ContestPicker({
  contests,
  current,
  copies,
}: {
  contests: PastContest[];
  current: PastContest | null;
  /** What's copied and what starts fresh, shown as soon as a contest is chosen. */
  copies: ReactNode;
}) {
  const router = useRouter();
  // The form as it was filled in (by default or from a contest): anything different since was typed.
  const filled = useRef<Record<string, string>>({});
  useEffect(() => {
    const form = detailsForm();
    filled.current = Object.fromEntries(FIELDS.map(([name]) => [name, fieldValue(form, name)]));
  }, []);
  const [picked, setPicked] = useState(current?.id ?? "");
  const [loading, startTransition] = useTransition();
  const choice = contests.find((c) => c.id === picked) ?? null;
  const unchanged = picked === (current?.id ?? "");

  const use = async () => {
    if (loading) return;
    const form = detailsForm();
    // Typed since the form was filled in: ask before replacing it. The date always stays.
    const typed = FIELDS.filter(([name]) => fieldValue(form, name) !== (filled.current[name] ?? ""))
      // A one-day contest's end date just follows its date.
      .filter(([name]) => name !== "endsOn" || fieldValue(form, "endsOn") !== fieldValue(form, "startsOn"))
      .map(([, label]) => label);
    if (
      typed.length &&
      !(await confirmDialog({
        title: choice ? `Replace what you typed with ${choice.name}'s details?` : "Clear the details to start from scratch?",
        message: `This replaces ${list(typed)}. Your date stays.`,
        confirmLabel: choice ? "Replace" : "Clear",
      }))
    )
      return;
    const on = fieldValue(form, "startsOn");
    const q = new URLSearchParams({ type: "band_contest" });
    if (picked) q.set("from", picked);
    if (/^\d{4}-\d{2}-\d{2}$/.test(on)) q.set("on", on);
    if (picked) q.set("picked", "1");
    startTransition(() => router.replace(`/dashboard/events/new?${q}`, { scroll: false }));
  };

  return (
    <div className="space-y-3">
      <Field label="Contest to copy">
        <Select value={picked} onChange={(e) => setPicked(e.target.value)}>
          <option value="">Start from scratch</option>
          {contests.map((c) => (
            <option key={c.id} value={c.id}>
              {c.date} · {c.name}
            </option>
          ))}
        </Select>
      </Field>
      {choice && (
        // The whole choice, wrapped, since a phone cuts off the dropdown's text.
        <p className="text-sm">
          <span className="font-semibold">{choice.name}</span>
          <span className="block text-muted">
            {choice.date}
            {choice.venue ? ` · ${choice.venue}` : ""}
          </span>
        </p>
      )}
      {choice && copies}
      {!unchanged && (
        <button
          type="button"
          onClick={use}
          aria-disabled={loading || undefined}
          className="inline-flex min-h-11 items-center rounded-md border-[1.5px] border-brand bg-surface px-4 text-sm font-semibold text-brand hover:bg-brand-soft aria-disabled:cursor-wait aria-disabled:opacity-60"
        >
          {choice ? "Use this contest" : "Start from scratch"}
        </button>
      )}
      <p aria-live="polite" className="sr-only">
        {loading
          ? "Filling in…"
          : current && unchanged
            ? `Filled in the name, times, and venue from ${current.name}. Pick the new contest date.`
            : ""}
      </p>
    </div>
  );
}
