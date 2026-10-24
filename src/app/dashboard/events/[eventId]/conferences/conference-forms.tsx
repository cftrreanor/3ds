"use client";

import { createContext, use, useState, type ReactNode } from "react";
import { ActionForm } from "@/components/action-form";
import { PublishBar, PublishLine } from "@/components/publish-bar";
import { NumberInput } from "@/components/number-input";
import { SubmitButton } from "@/components/submit-button";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { VenuePicker, type VenueValue } from "@/components/venue-picker";
import type { ActionState } from "@/lib/action-state";
import { brand } from "@/lib/brand";
import {
  AHEAD_DAYS,
  aheadLabel,
  GAP_LENGTHS,
  MEETING_LENGTHS,
  MODES,
  modesOf,
  meetingStarts,
  meetingSummary,
  NOTICE_HOURS,
  noticeLabel,
  dateRuns,
  datesBetween,
  groupWeekly,
  sortWeekly,
  WEEKDAYS,
  weeklyMeetingCount,
  type ConferenceSettings,
  type Mode,
  type Schedule,
} from "@/lib/conferences";
import { displayTime, formatDuration } from "@/lib/schedule";
import { formatDate } from "@/lib/time";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

// Which steps have unsaved changes: publishing waits until they're saved or
// cancelled (see "Setup pages" in docs/DESIGN.md).
const Editing = createContext<{ editing: string[]; set: (id: string, on: boolean) => void }>({ editing: [], set: () => {} });

/** The setup steps and their publish bar, sharing which steps are being edited. */
export function ConferenceSetup({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState<string[]>([]);
  const set = (id: string, on: boolean) =>
    setEditing((ids) => (on ? (ids.includes(id) ? ids : [...ids, id]) : ids.filter((x) => x !== id)));
  return (
    <Editing value={{ editing, set }}>
      <div className="mt-6 flex flex-col gap-3">{children}</div>
    </Editing>
  );
}

function useEditing(id: string) {
  const { editing, set } = use(Editing);
  return [editing.includes(id), (on: boolean) => set(id, on)] as const;
}

/** Publish or unpublish the conference; waits while a step has unsaved changes. */
export function ConferencePublishBar({
  published,
  missing,
  children,
}: {
  published: boolean;
  /** What's still needed before publishing, or null when ready. */
  missing: string | null;
  /** The Publish / Unpublish button. */
  children?: ReactNode;
}) {
  const { editing } = use(Editing);
  const busy = editing.length > 0;
  return (
    <PublishBar>
      <PublishLine
        label="Conference"
        on={published}
        status={published ? "Published: your public page is online" : missing ? `Not published. ${missing}` : "Not published"}
      >
        {!busy && (published || !missing) ? children : null}
      </PublishLine>
      {busy && <p className="text-sm text-muted">Save or cancel your changes first, then publish.</p>}
    </PublishBar>
  );
}

/** Save and Cancel under a step's boxes; Cancel shows only once something has changed. */
function SaveCancel({ editing, onCancel, label, disabled }: { editing: boolean; onCancel: () => void; label: string; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <SubmitButton disabled={disabled}>{label}</SubmitButton>
      {editing && (
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      )}
    </div>
  );
}

type BreakDraft = { key: number; start: string; minutes: string; label: string };
type GroupDraft = { key: number; days: number[]; start: string; end: string };
type DaysOffDraft = { key: number; from: string; to: string };

/** Days of the week, Sunday first (0), as short tap targets. */
const DAY_LETTERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type TimesProps = {
  action: Action;
  initial: ConferenceSettings;
  /** The conference day (or with weekly hours, the first day), "YYYY-MM-DD". */
  date: string;
  /** With weekly hours, the last day, "YYYY-MM-DD". */
  endDate: string;
  /** The conference's hours, "HH:MM" in the event's time zone. */
  start: string;
  end: string;
  /** How many meeting times families have booked. */
  booked: number;
  /** The account has a plan, so weekly hours can be published. */
  premium: boolean;
};

/** Step 1: one day or weekly hours, how long each meeting is, a gap between them, and breaks, with the meetings they make. */
export function MeetingTimesForm(props: TimesProps) {
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useEditing("times");
  return (
    <TimesForm
      key={version}
      {...props}
      editing={editing}
      setEditing={setEditing}
      onCancel={() => {
        setVersion((v) => v + 1);
        setEditing(false);
      }}
    />
  );
}

const SCHEDULES: { value: Schedule; label: string; hint: string }[] = [
  { value: "one_day", label: "One day", hint: "A conference day, like fall or spring conferences." },
  { value: "weekly", label: "Every week", hint: "The same times each week, like calls on Tuesday afternoons." },
];

function TimesForm({
  action,
  initial,
  date,
  endDate,
  start,
  end,
  booked,
  premium,
  editing,
  setEditing,
  onCancel,
}: TimesProps & { editing: boolean; setEditing: (on: boolean) => void; onCancel: () => void }) {
  const [schedule, setSchedule] = useState<Schedule>(initial.schedule);
  const weekly = schedule === "weekly";
  const [meeting, setMeeting] = useState(initial.meeting_minutes);
  const [gap, setGap] = useState(initial.gap_minutes);
  const [breaks, setBreaks] = useState<BreakDraft[]>(() =>
    initial.breaks.map((b, i) => ({ key: i, start: b.start, minutes: String(b.minutes), label: b.label })),
  );
  // Weekly hours as days that share the same times; each picked day is saved as its own block.
  const [groups, setGroups] = useState<GroupDraft[]>(() => groupWeekly(initial.weekly_hours).map((g, i) => ({ key: i, ...g })));
  // Days off as runs of dates (a single day, or a break like Dec 21 – Jan 4).
  const [daysOff, setDaysOff] = useState<DaysOffDraft[]>(() => dateRuns(initial.closed_dates).map((r, i) => ({ key: i, ...r })));
  const [nextKey, setNextKey] = useState(100);
  const newKey = () => {
    setNextKey((k) => k + 1);
    return nextKey;
  };
  // The day and hours can be changed right here; saving moves the event too.
  const [changingHours, setChangingHours] = useState(false);
  const [day, setDay] = useState(date);
  const [from, setFrom] = useState(start);
  const [to, setTo] = useState(end);
  const [firstDay, setFirstDay] = useState(date);
  const [lastDay, setLastDay] = useState(initial.schedule === "weekly" ? endDate : "");
  // Coming back from weekly hours to one day: pick the day.
  const askDay = changingHours || (!weekly && initial.schedule === "weekly");
  const lengths = { meeting_minutes: meeting, gap_minutes: gap, breaks: breaks.map((b) => ({ start: b.start, minutes: Number(b.minutes) || 0, label: b.label })) };
  const starts = meetingStarts(from, to, lengths);
  const weeklyHours = groups.flatMap((g) => (g.start && g.end && g.end > g.start ? g.days.map((day) => ({ day, start: g.start, end: g.end })) : []));
  const perWeek = weeklyMeetingCount(weeklyHours, lengths);
  const offDates = [...new Set(daysOff.flatMap((d) => datesBetween(d.from, d.to)))];
  const changeGroup = (key: number, patch: Partial<GroupDraft>) => setGroups((gs) => gs.map((g) => (g.key === key ? { ...g, ...patch } : g)));
  const change = (key: number, patch: Partial<BreakDraft>) => setBreaks((bs) => bs.map((b) => (b.key === key ? { ...b, ...patch } : b)));

  return (
    <ActionForm
      action={action}
      resetOnSuccess={false}
      className="space-y-5"
      onEdit={() => setEditing(true)}
      onSuccess={() => {
        setEditing(false);
        setChangingHours(false);
      }}
    >
      <fieldset>
        <legend className="text-sm font-semibold">When can families meet with you?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {SCHEDULES.map((o) => {
            // Booked meetings stay as booked: switching waits until they're canceled.
            const locked = booked > 0 && o.value !== initial.schedule;
            return (
            <label
              key={o.value}
              className={`flex gap-3 rounded-lg border p-3 ${locked ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${schedule === o.value ? "border-brand bg-brand-soft" : "border-field-border"}`}
            >
              <input
                type="radio"
                name="schedule"
                value={o.value}
                disabled={locked}
                checked={schedule === o.value}
                onChange={() => {
                  setSchedule(o.value);
                  if (o.value === "weekly" && !groups.length) setGroups([{ key: newKey(), days: [2, 4], start: "15:30", end: "16:30" }]);
                }}
                className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand)]"
              />
              <span>
                <span className="flex flex-wrap items-center gap-2 font-semibold">
                  {o.label}
                  {o.value === "weekly" && <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-brand-foreground">Premium</span>}
                </span>
                <span className="block text-sm text-muted">
                  {locked ? "Families have booked. Cancel their meetings on your Meetings page to switch." : o.hint}
                </span>
              </span>
            </label>
            );
          })}
        </div>
      </fieldset>

      {weekly && !premium && (
        <p className="rounded-md border border-border bg-brand-soft px-3 py-2 text-sm leading-6">
          <strong>Weekly hours are a premium feature.</strong> You can set them up now. To publish them, write to us at{" "}
          <a href={`mailto:${brand.supportEmail}`} className="font-medium text-brand underline underline-offset-4">
            {brand.supportEmail}
          </a>{" "}
          and we&apos;ll add them to your account.
        </p>
      )}

      {weekly ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First day">
              <Input type="date" name="weeklyFrom" required value={firstDay} onChange={(e) => setFirstDay(e.target.value)} />
            </Field>
            <Field label="Last day" hint="For example, the last day of the semester.">
              <Input type="date" name="weeklyTo" required min={firstDay} value={lastDay} onChange={(e) => setLastDay(e.target.value)} />
            </Field>
          </div>

          <fieldset>
            <legend className="text-sm font-semibold">Weekly hours</legend>
            <p className="text-sm text-muted">Tap the days you meet, then set your hours.</p>
            <ul className="mt-3 space-y-3">
              {groups.map((g, gi) => (
                <li key={g.key} className="space-y-3 rounded-lg border border-border p-3">
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={groups.length > 1 ? `Days for hours ${gi + 1}` : "Days"}>
                    {DAY_LETTERS.map((label, day) => {
                      const on = g.days.includes(day);
                      return (
                        <button
                          key={label}
                          type="button"
                          aria-pressed={on}
                          aria-label={WEEKDAYS[day]}
                          onClick={() => {
                            changeGroup(g.key, { days: on ? g.days.filter((d) => d !== day) : [...g.days, day].sort() });
                            setEditing(true);
                          }}
                          className={`min-h-11 min-w-12 rounded-md border px-2 text-sm font-semibold ${
                            on ? "border-brand bg-brand text-brand-foreground" : "border-field-border hover:border-brand"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[8rem_8rem_auto]">
                    <Field label="From">
                      <Input type="time" required value={g.start} onChange={(e) => changeGroup(g.key, { start: e.target.value })} />
                    </Field>
                    <Field label="To">
                      <Input type="time" required value={g.end} onChange={(e) => changeGroup(g.key, { end: e.target.value })} />
                    </Field>
                    {groups.length > 1 && (
                      <Button
                        type="button"
                        variant="danger"
                        className="col-span-2 sm:col-span-1"
                        onClick={() => {
                          setGroups((gs) => gs.filter((x) => x.key !== g.key));
                          setEditing(true);
                        }}
                      >
                        Remove Hours
                      </Button>
                    )}
                  </div>
                  {!g.days.length && <p className="text-sm font-semibold text-danger">Tap at least one day.</p>}
                  {/* Saved as one block per day. */}
                  {g.days.map((day) => (
                    <span key={day} hidden>
                      <input type="hidden" name="weeklyDay" value={day} />
                      <input type="hidden" name="weeklyStart" value={g.start} />
                      <input type="hidden" name="weeklyEnd" value={g.end} />
                    </span>
                  ))}
                </li>
              ))}
            </ul>
            {groups.length < 7 && (
              <Button
                type="button"
                variant="secondary"
                className="mt-3"
                onClick={() => {
                  setGroups((gs) => [...gs, { key: newKey(), days: [], start: "15:30", end: "16:30" }]);
                  setEditing(true);
                }}
              >
                + Add different hours
              </Button>
            )}
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold">Days off</legend>
            <p className="text-sm text-muted">
              Holidays, field trips, or a break like winter break. No meetings are booked on them. Leave the last day blank for a single day.
            </p>
            {daysOff.length > 0 && (
              <ul className="mt-3 space-y-3">
                {daysOff.map((d) => (
                  <li key={d.key} className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[10rem_10rem_auto]">
                    <Field label="Day off">
                      <Input
                        type="date"
                        required
                        value={d.from}
                        onChange={(e) => setDaysOff((ds) => ds.map((x) => (x.key === d.key ? { ...x, from: e.target.value } : x)))}
                      />
                    </Field>
                    <Field label="Through (optional)">
                      <Input
                        type="date"
                        min={d.from}
                        value={d.to === d.from ? "" : d.to}
                        onChange={(e) => setDaysOff((ds) => ds.map((x) => (x.key === d.key ? { ...x, to: e.target.value } : x)))}
                      />
                    </Field>
                    <Button
                      type="button"
                      variant="danger"
                      className="col-span-2 sm:col-span-1"
                      onClick={() => {
                        setDaysOff((ds) => ds.filter((x) => x.key !== d.key));
                        setEditing(true);
                      }}
                    >
                      Remove Day Off
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {offDates.map((date) => (
              <input key={date} type="hidden" name="closedDate" value={date} />
            ))}
            {offDates.length > 60 && <p className="mt-2 text-sm font-semibold text-danger">Add up to 60 days off in all.</p>}
            <Button
              type="button"
              variant="secondary"
              className="mt-3"
              onClick={() => {
                setDaysOff((ds) => [...ds, { key: newKey(), from: "", to: "" }]);
                setEditing(true);
              }}
            >
              + Add a day off
            </Button>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Families book at least" hint="So no one books a meeting that starts in a few minutes.">
              <Select name="minNotice" defaultValue={initial.min_notice_hours}>
                {NOTICE_HOURS.map((h) => (
                  <option key={h} value={h}>
                    {h ? `${noticeLabel(h)} ahead` : noticeLabel(h)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Families can book up to" hint="So your calendar doesn't fill up for the whole semester on day one.">
              <Select name="maxAhead" defaultValue={initial.max_days_ahead}>
                {AHEAD_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {aheadLabel(d)} ahead
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      ) : askDay ? (
        <div className="grid gap-4 rounded-lg border border-border p-3 sm:grid-cols-3">
          <Field label="Conference day">
            <Input type="date" name="conferenceDay" required value={day} onChange={(e) => setDay(e.target.value)} />
          </Field>
          <Field label="First meeting starts">
            <Input type="time" name="startTime" required value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Last meeting ends by">
            <Input type="time" name="endTime" required value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          {booked > 0 && day !== date && initial.schedule === "one_day" && (
            <p className="text-sm text-muted sm:col-span-3">
              {booked === 1 ? "The booked meeting moves" : `All ${booked} booked meetings move`} to this day at the same time, and we email
              each family an updated calendar invite with a link to pick another time or cancel.
            </p>
          )}
        </div>
      ) : (
        <p className="rounded-md bg-background px-3 py-2 text-sm">
          <span className="font-medium">
            {formatDate(day, { year: undefined, weekday: "long" })} · {displayTime(from)} – {displayTime(to)}
          </span>{" "}
          <button
            type="button"
            onClick={() => {
              setChangingHours(true);
              setEditing(true);
            }}
            className="font-medium text-brand underline underline-offset-4"
          >
            Change the day or hours
          </button>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Each meeting">
          <Select name="meetingMinutes" value={meeting} onChange={(e) => setMeeting(Number(e.target.value))}>
            {MEETING_LENGTHS.map((m) => (
              <option key={m} value={m}>
                {formatDuration(m)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Time between meetings" hint="A moment to write notes or let the next family in.">
          <Select name="gapMinutes" value={gap} onChange={(e) => setGap(Number(e.target.value))}>
            {GAP_LENGTHS.map((m) => (
              <option key={m} value={m}>
                {m ? formatDuration(m) : "None, back to back"}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div>
        <p className="text-sm font-semibold">Breaks</p>
        <p className="text-sm text-muted">
          {weekly ? "A time you're never free, on every day you meet. No meetings are booked during them." : "Dinner, or a few minutes to catch up. No meetings are booked during them."}
        </p>
        {breaks.length > 0 && (
          <ul className="mt-3 space-y-3">
            {breaks.map((b) => (
              <li key={b.key} className="grid grid-cols-2 items-end gap-3 rounded-lg border border-border p-3 sm:grid-cols-[8rem_7rem_1fr_auto]">
                <Field label="Starts">
                  <Input type="time" name="breakStart" required value={b.start} onChange={(e) => change(b.key, { start: e.target.value })} />
                </Field>
                <Field label="Minutes">
                  <NumberInput name="breakMinutes" required maxLength={3} value={b.minutes} onChange={(e) => change(b.key, { minutes: e.target.value })} />
                </Field>
                <Field label="Name (optional)" className="col-span-2 sm:col-span-1">
                  <Input name="breakLabel" maxLength={60} value={b.label} placeholder="e.g. Dinner" onChange={(e) => change(b.key, { label: e.target.value })} />
                </Field>
                <Button
                  type="button"
                  variant="danger"
                  className="col-span-2 sm:col-span-1"
                  onClick={() => {
                    setBreaks((bs) => bs.filter((x) => x.key !== b.key));
                    setEditing(true);
                  }}
                >
                  Remove Break
                </Button>
              </li>
            ))}
          </ul>
        )}
        {breaks.length < 8 && (
          <Button
            type="button"
            variant="secondary"
            className="mt-3"
            onClick={() => {
              setBreaks((bs) => [...bs, { key: newKey(), start: "", minutes: "30", label: "" }]);
              setEditing(true);
            }}
          >
            + Add a break
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-background p-4">
        {weekly ? (
          <>
            <p className="font-semibold">
              {perWeek ? `${perWeek} ${perWeek === 1 ? "meeting" : "meetings"} each week` : "No meetings fit in your weekly hours yet"}
            </p>
            {perWeek > 0 ? (
              <ul className="mt-3 space-y-3" aria-label="Meeting times each week">
                {sortWeekly(weeklyHours).map((h) => (
                  <li key={`${h.day}-${h.start}-${h.end}`}>
                    <p className="text-sm font-medium">
                      {WEEKDAYS[h.day]}s, {displayTime(h.start)} – {displayTime(h.end)}
                    </p>
                    <ul className="mt-1 flex flex-wrap gap-2">
                      {meetingStarts(h.start, h.end, lengths).map((t) => (
                        <li key={t} className="rounded-sm border border-border bg-surface px-2 py-1 text-sm tabular-nums">
                          {displayTime(t)}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-muted">Try shorter meetings, fewer breaks, or longer hours.</p>
            )}
          </>
        ) : (
          <>
            <p className="font-semibold">{meetingSummary(starts, meeting)}</p>
            {starts.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-2" aria-label="Meeting times">
                {starts.map((t) => (
                  <li key={t} className="rounded-sm border border-border bg-surface px-2 py-1 text-sm tabular-nums">
                    {displayTime(t)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-muted">Try shorter meetings, fewer breaks, or longer hours.</p>
            )}
          </>
        )}
      </div>

      <SaveCancel editing={editing} onCancel={onCancel} label="Save meeting times" />
    </ActionForm>
  );
}

type PlaceProps = {
  action: Action;
  initial: ConferenceSettings;
  /** "3:00 PM – 7:00 PM" */
  hours: string;
  /** The school, kept on the event: shown on the public page and in calendar invites. */
  venue: VenueValue;
  venueSearchEnabled: boolean;
  timezone: string;
};

/** Step 2: in person, video (one meeting with a waiting room for the whole time), or the family's choice. */
export function MeetingPlaceForm(props: PlaceProps) {
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useEditing("place");
  return (
    <PlaceForm
      key={version}
      {...props}
      editing={editing}
      setEditing={setEditing}
      onCancel={() => {
        setVersion((v) => v + 1);
        setEditing(false);
      }}
    />
  );
}

function PlaceForm({
  action,
  initial,
  hours,
  venue,
  venueSearchEnabled,
  timezone,
  editing,
  setEditing,
  onCancel,
}: PlaceProps & { editing: boolean; setEditing: (on: boolean) => void; onCancel: () => void }) {
  const [modes, setModes] = useState<Mode[]>(modesOf(initial));
  const [link, setLink] = useState(initial.video_link ?? "");
  const [ownLink, setOwnLink] = useState(initial.own_link);
  const inPerson = modes.includes("in_person");
  const video = modes.includes("video");
  const toggle = (m: Mode) => setModes((now) => (now.includes(m) ? now.filter((x) => x !== m) : [...now, m]));
  const linkOk = /^https:\/\/\S+$/.test(link.trim());

  return (
    <ActionForm
      action={action}
      resetOnSuccess={false}
      className="space-y-5"
      onEdit={() => setEditing(true)}
      onSuccess={() => setEditing(false)}
    >
      <fieldset>
        <legend className="text-sm font-semibold">How will you meet?</legend>
        <p className="mt-1 text-sm text-muted">Choose all that work for you. With more than one, each family picks when they book.</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {MODES.map((m) => (
            <label
              key={m.value}
              className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${modes.includes(m.value) ? "border-brand bg-brand-soft" : "border-field-border"}`}
            >
              <input
                type="checkbox"
                name="modes"
                value={m.value}
                checked={modes.includes(m.value)}
                onChange={() => toggle(m.value)}
                className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand)]"
              />
              <span>
                <span className="block font-semibold">{m.label}</span>
                <span className="block text-sm text-muted">{m.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {inPerson && (
        <fieldset className="grid gap-4">
          <legend className="mb-1 text-sm font-semibold">Your school</legend>
          <p className="-mt-2 text-sm text-muted">Shown on your public page and in families&apos; calendar invites.</p>
          <VenuePicker searchEnabled={venueSearchEnabled} initial={venue} timezone={timezone} kind="School" example="e.g. Cedar Ridge Elementary" />
        </fieldset>
      )}

      {inPerson && (
        <Field label="Room and directions" hint="Families get this in their confirmation and reminder.">
          <Textarea
            name="room"
            required
            rows={2}
            maxLength={200}
            defaultValue={initial.room ?? ""}
            placeholder="e.g. Room 214, purple hallway, 3rd door on the left"
          />
        </Field>
      )}

      {video && (
        <div className="space-y-4">
          <WaitingRoomGuide hours={hours} />
          <fieldset>
            <legend className="text-sm font-semibold">How do families get the link?</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {[
                { own: false, label: "Paste it here", hint: "We send it to each family in their confirmation and reminder." },
                { own: true, label: "I'll add it to each invite", hint: "You add a video link to each meeting's calendar invite yourself." },
              ].map((o) => (
                <label
                  key={o.label}
                  className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${ownLink === o.own ? "border-brand bg-brand-soft" : "border-field-border"}`}
                >
                  <input
                    type="radio"
                    name="linkSource"
                    value={o.own ? "own" : "here"}
                    checked={ownLink === o.own}
                    onChange={() => setOwnLink(o.own)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand)]"
                  />
                  <span>
                    <span className="block font-semibold">{o.label}</span>
                    <span className="block text-sm text-muted">{o.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {ownLink ? (
            <p className="rounded-md bg-background px-3 py-2 text-sm">
              <strong>You&apos;ll need to add a video link to the calendar invite for each meeting.</strong> We won&apos;t
              send families a link; they&apos;re told it will come in your invite before their meeting. Each family&apos;s
              email is on your list once they book.
            </p>
          ) : (
            <>
              <Field label="Meeting link" hint="Only families who book get it, in their confirmation and reminder. It's never on your public page.">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    name="videoLink"
                    type="url"
                    required
                    maxLength={500}
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://zoom.us/j/… or https://meet.google.com/…"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0"
                    disabled={!linkOk}
                    onClick={() => window.open(link.trim(), "_blank", "noopener,noreferrer")}
                  >
                    Test the link
                  </Button>
                </div>
              </Field>
              <label className="flex gap-3 rounded-lg border border-field-border p-3 text-sm leading-6">
                <input
                  type="checkbox"
                  name="waitingRoom"
                  required
                  defaultChecked={initial.waiting_room_confirmed}
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand)]"
                />
                <span>
                  <span className="font-semibold">My meeting has a waiting room, and it runs the whole time ({hours}).</span>{" "}
                  <span className="text-muted">Families wait there until you let them in, so meetings never overlap.</span>
                </span>
              </label>
            </>
          )}
        </div>
      )}

      {inPerson && (
        <p className="text-sm text-muted">
          In-person families are asked to wait outside your room. You invite them in when you&apos;re ready.
        </p>
      )}

      {modes.includes("phone") && (
        <div className="rounded-lg border border-border bg-brand-soft p-4 text-sm leading-6">
          <p className="font-semibold">You call each family</p>
          <p className="mt-1">
            Families give the number to call when they book, and it&apos;s on your Meetings page and in your calendar invite.
            We never ask for your number or share it.
          </p>
          <p className="mt-2">
            Calling from your own phone? In the US, dial <strong>*67</strong> before the number to hide yours. Some
            families don&apos;t answer hidden numbers, so a school phone or calling app works best.
          </p>
        </div>
      )}

      <SaveCancel editing={editing} onCancel={onCancel} label="Save" disabled={!modes.length} />
    </ActionForm>
  );
}

/** How to set up one meeting with a waiting room, for Zoom and Google Meet. */
function WaitingRoomGuide({ hours }: { hours: string }) {
  return (
    <div className="rounded-lg border border-border bg-brand-soft p-4 text-sm leading-6">
      <p className="font-semibold">Set up one meeting for the whole time</p>
      <p className="mt-1">
        Create a single meeting that runs {hours}, with a waiting room turned on. Every family gets the same link and
        waits until you let them in, so meetings never overlap. Families are asked to join using the name on their
        booking (&ldquo;Ava Lopez&apos;s family,&rdquo; or a parent&apos;s own name when you don&apos;t ask for the child&apos;s), so
        you can match the waiting room to your list.
      </p>
      <details className="mt-3 rounded-md border border-border bg-surface px-3 py-2">
        <summary className="cursor-pointer font-semibold">Zoom</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            Sign in with your <strong>school</strong> Zoom account. Free personal accounts end every meeting after 40
            minutes, and families in the waiting room count toward that time.
          </li>
          <li>Schedule a meeting from your first conference to your last.</li>
          <li>
            Under Security, tick <strong>Waiting Room</strong>. Leave &ldquo;Allow participants to join before
            host&rdquo; off.
          </li>
          <li>Copy the invite link and paste it below.</li>
        </ol>
      </details>
      <details className="mt-2 rounded-md border border-border bg-surface px-3 py-2">
        <summary className="cursor-pointer font-semibold">Google Meet</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            Sign in with your <strong>school</strong> Google account.
          </li>
          <li>In Google Calendar, create an event that covers your whole time, and add Google Meet video conferencing.</li>
          <li>
            Don&apos;t invite parents to the calendar event. That way each family has to <strong>ask to join</strong>,
            and you choose when to let them in.
          </li>
          <li>
            In the meeting&apos;s host controls, set access to <strong>Restricted</strong> if your school allows it.
          </li>
          <li>Copy the Meet link and paste it below.</li>
        </ol>
      </details>
    </div>
  );
}
