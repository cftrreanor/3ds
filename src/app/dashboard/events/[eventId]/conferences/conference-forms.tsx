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
  MEETING_MODES,
  meetingStarts,
  meetingSummary,
  NOTICE_HOURS,
  noticeLabel,
  sortWeekly,
  WEEKDAYS,
  weeklyMeetingCount,
  type ConferenceSettings,
  type MeetingMode,
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
type RangeDraft = { key: number; day: string; start: string; end: string };
type DateDraft = { key: number; date: string };

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
  const [ranges, setRanges] = useState<RangeDraft[]>(() =>
    sortWeekly(initial.weekly_hours).map((h, i) => ({ key: i, day: String(h.day), start: h.start, end: h.end })),
  );
  const [closed, setClosed] = useState<DateDraft[]>(() => initial.closed_dates.map((d, i) => ({ key: i, date: d })));
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
  const weeklyHours = ranges.filter((r) => r.start && r.end && r.end > r.start).map((r) => ({ day: Number(r.day), start: r.start, end: r.end }));
  const perWeek = weeklyMeetingCount(weeklyHours, lengths);
  const change = (key: number, patch: Partial<BreakDraft>) => setBreaks((bs) => bs.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  const changeRange = (key: number, patch: Partial<RangeDraft>) => setRanges((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

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
          {SCHEDULES.map((o) => (
            <label
              key={o.value}
              className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${schedule === o.value ? "border-brand bg-brand-soft" : "border-field-border"}`}
            >
              <input
                type="radio"
                name="schedule"
                value={o.value}
                checked={schedule === o.value}
                onChange={() => {
                  setSchedule(o.value);
                  if (o.value === "weekly" && !ranges.length) setRanges([{ key: newKey(), day: "2", start: "15:30", end: "16:30" }]);
                }}
                className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand)]"
              />
              <span>
                <span className="flex flex-wrap items-center gap-2 font-semibold">
                  {o.label}
                  {o.value === "weekly" && <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-brand-foreground">Premium</span>}
                </span>
                <span className="block text-sm text-muted">{o.hint}</span>
              </span>
            </label>
          ))}
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

          <div>
            <p className="text-sm font-semibold">Weekly hours</p>
            <p className="text-sm text-muted">Add a row for each block of time. Add two rows for two blocks on the same day.</p>
            <ul className="mt-3 space-y-3">
              {ranges.map((r) => (
                <li key={r.key} className="grid grid-cols-2 items-end gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_8rem_8rem_auto]">
                  <Field label="Day" className="col-span-2 sm:col-span-1">
                    <Select name="weeklyDay" value={r.day} onChange={(e) => changeRange(r.key, { day: e.target.value })}>
                      {WEEKDAYS.map((w, i) => (
                        <option key={w} value={i}>
                          {w}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="From">
                    <Input type="time" name="weeklyStart" required value={r.start} onChange={(e) => changeRange(r.key, { start: e.target.value })} />
                  </Field>
                  <Field label="To">
                    <Input type="time" name="weeklyEnd" required value={r.end} onChange={(e) => changeRange(r.key, { end: e.target.value })} />
                  </Field>
                  <Button
                    type="button"
                    variant="danger"
                    className="col-span-2 sm:col-span-1"
                    disabled={ranges.length === 1}
                    onClick={() => {
                      setRanges((rs) => rs.filter((x) => x.key !== r.key));
                      setEditing(true);
                    }}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
            {ranges.length < 21 && (
              <Button
                type="button"
                variant="secondary"
                className="mt-3"
                onClick={() => {
                  const last = ranges.at(-1);
                  setRanges((rs) => [...rs, { key: newKey(), day: last?.day ?? "2", start: last?.start ?? "15:30", end: last?.end ?? "16:30" }]);
                  setEditing(true);
                }}
              >
                + Add hours
              </Button>
            )}
          </div>

          <div>
            <p className="text-sm font-semibold">Days off</p>
            <p className="text-sm text-muted">Holidays, field trips, or any day you can&apos;t meet. No meetings are booked on them.</p>
            {closed.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-3">
                {closed.map((c) => (
                  <li key={c.key} className="flex items-end gap-2">
                    <Field label="Day off">
                      <Input
                        type="date"
                        name="closedDate"
                        required
                        value={c.date}
                        onChange={(e) => setClosed((cs) => cs.map((x) => (x.key === c.key ? { ...x, date: e.target.value } : x)))}
                      />
                    </Field>
                    <Button
                      type="button"
                      variant="secondary"
                      aria-label="Remove this day off"
                      onClick={() => {
                        setClosed((cs) => cs.filter((x) => x.key !== c.key));
                        setEditing(true);
                      }}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {closed.length < 60 && (
              <Button
                type="button"
                variant="secondary"
                className="mt-3"
                onClick={() => {
                  setClosed((cs) => [...cs, { key: newKey(), date: "" }]);
                  setEditing(true);
                }}
              >
                + Add a day off
              </Button>
            )}
          </div>

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
  const [mode, setMode] = useState<MeetingMode | null>(initial.meeting_mode);
  const [link, setLink] = useState(initial.video_link ?? "");
  const [ownLink, setOwnLink] = useState(initial.own_link);
  const inPerson = mode === "in_person" || mode === "either";
  const video = mode === "video" || mode === "either";
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
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {MEETING_MODES.map((m) => (
            <label
              key={m.value}
              className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${mode === m.value ? "border-brand bg-brand-soft" : "border-field-border"}`}
            >
              <input
                type="radio"
                name="mode"
                value={m.value}
                required
                checked={mode === m.value}
                onChange={() => setMode(m.value)}
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

      {mode === "phone" && (
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

      <SaveCancel editing={editing} onCancel={onCancel} label="Save" disabled={!mode} />
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
        waits until you let them in, so meetings never overlap. Families are asked to join using their child&apos;s
        name (&ldquo;Ava Lopez&apos;s family&rdquo;), so you can match the waiting room to your list.
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
