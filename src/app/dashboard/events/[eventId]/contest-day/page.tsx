import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card } from "@/components/ui";
import { AutoRefresh } from "@/app/e/[slug]/auto-refresh";
import {
  ACTION_LABEL,
  hasEquipment,
  kindLabel,
  parking,
  sortStations,
  whereIs,
  vehicles,
  type BandDay,
  type Checkpoint,
  type Round,
  type Stop,
  type Tone,
} from "@/lib/contest-day";
import { requireUser } from "@/lib/auth";
import { getEventAccess } from "@/lib/data";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { formatTime } from "@/lib/time";
import {
  addBandNote,
  bandAction,
  deleteBandNote,
  setEquipmentSpots,
  undoBandAction,
  type BandActionName,
} from "../../../contest-day-actions";
import { LotSizeForm, NoteForm, TapButton } from "./controls";

export const metadata: Metadata = { title: "Contest day" };

type Band = BandDay & {
  band_name: string;
  school_name: string;
  classification: string;
  contest_day_conflicts: string | null;
  special_needs: string | null;
};
type Slot = { band_id: string | null; order: number; warm_up_at: string | null; warm_up_location: string | null; perform_at: string | null };
type Note = { id: string; band_id: string; body: string; author_name: string | null; created_by: string; created_at: string };
type Activity = {
  band_id: string;
  station_id: string | null;
  action: string;
  round: Round | null;
  detail: string | null;
  actor_name: string | null;
  created_by: string | null;
  created_at: string;
};

const PIN: Record<Tone, string> = { red: "text-danger", gold: "text-accent", green: "text-success", neutral: "text-muted" };
const minus = (iso: string, minutes: number) => new Date(new Date(iso).getTime() - minutes * 60_000).toISOString();

/** One tab per check-in station, in the band's order, with one-tap buttons, notes and undo. */
export default async function ContestDayPage({ params, searchParams }: PageProps<"/dashboard/events/[eventId]/contest-day">) {
  const { eventId } = await params;
  const { station: stationParam, round: roundParam, view } = await searchParams;
  const user = await requireUser();
  const access = await getEventAccess(eventId);
  const supabase = await createClient();

  const [{ data: event }, { data: pathData }, { data: myLeads }] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, timezone, equipment_spots, ready_minutes_before, finals_ready_minutes_before")
      .eq("id", eventId)
      .maybeSingle(),
    supabase.from("stations").select("id, name, checkpoint_kind, checkpoint_order").eq("event_id", eventId).not("checkpoint_kind", "is", null),
    supabase.from("station_leads").select("station_id").eq("event_id", eventId).eq("user_id", user.id),
  ]);
  if (!event) missing();
  const path = sortStations((pathData ?? []) as Checkpoint[]);
  // Hosts and Volunteer Leads work every station; Section Leads the ones they lead.
  const mine = access.canManage ? path : path.filter((c) => (myLeads ?? []).some((l) => l.station_id === c.id));
  if (mine.length === 0) redirect(`/dashboard/events/${eventId}`);
  const station = mine.find((c) => c.id === stationParam) ?? mine[0];
  const kind = station.checkpoint_kind;

  const [{ data: bandData }, { data: slotData }, { data: finalsData }, { data: stopData }, { data: noteData }, { data: activityData }] =
    await Promise.all([
      supabase.rpc("event_bands", { ev: eventId }),
      supabase
        .from("performance_slots")
        .select("band_id, performance_order, warm_up_at, warm_up_location, perform_at")
        .eq("event_id", eventId)
        .order("performance_order"),
      supabase
        .from("finals_slots")
        .select("band_id, slot_number, warm_up_at, warm_up_location, perform_at")
        .eq("event_id", eventId)
        .not("band_id", "is", null)
        .order("slot_number"),
      supabase.from("band_stops").select("band_id, station_id, round, performed, reached_at").eq("event_id", eventId),
      supabase.from("band_notes").select("id, band_id, body, author_name, created_by, created_at").eq("event_id", eventId).order("created_at", { ascending: false }),
      supabase
        .from("band_activity")
        .select("band_id, station_id, action, round, detail, actor_name, created_by, created_at")
        .eq("event_id", eventId)
        .is("undone_at", null)
        .order("id", { ascending: false })
        .limit(1000),
    ]);
  const bands = (bandData ?? []) as Band[];
  const stops = (stopData ?? []) as Stop[];
  const prelims: Slot[] = (slotData ?? []).map((s) => ({ ...s, order: s.performance_order }));
  const finals: Slot[] = (finalsData ?? []).map((s) => ({ ...s, order: s.slot_number }));
  const byRound = kind === "warm_up" || kind === "gate";
  const round: Round = byRound && roundParam === "finals" && finals.length > 0 ? "finals" : "prelims";
  const notesBy = groupBy((noteData ?? []) as Note[], (n) => n.band_id);
  const lastBy = new Map<string, Activity>();
  for (const a of (activityData ?? []) as Activity[]) if (!lastBy.has(a.band_id)) lastBy.set(a.band_id, a);
  const prelimSlot = new Map(prelims.map((s) => [s.band_id, s]));
  const roundSlots = round === "finals" ? finals : prelims;
  const slotOf = new Map(roundSlots.map((s) => [s.band_id, s]));
  const readyMinutes = round === "finals" ? event.finals_ready_minutes_before : event.ready_minutes_before;

  const tz = event.timezone;
  const time = (iso: string) => formatTime(iso, tz);
  const warmUpOrder = (b: Band) => prelimSlot.get(b.id)?.warm_up_at ?? prelimSlot.get(b.id)?.perform_at ?? "9999";
  const stopsAt = (b: Band, performed = false) =>
    stops.find((s) => s.band_id === b.id && s.station_id === station.id && s.performed === performed && (!byRound || s.round === round));
  const base = `/dashboard/events/${eventId}/contest-day`;
  const href = (q: Record<string, string>) => `${base}?${new URLSearchParams({ station: station.id, ...q })}`;

  // Each station's list, in the order it works through bands.
  const scratchedLast = (a: Band, b: Band) => Number(!!a.scratched_at) - Number(!!b.scratched_at);
  let list: Band[];
  if (kind === "parking") {
    const rank = { buses: 0, equipment: 0, nothing: 1, away: 2, all: 3, left: 4 } as const;
    list = [...bands].sort(
      (a, b) =>
        scratchedLast(a, b) ||
        rank[parking(a).key] - rank[parking(b).key] ||
        (a.equipment_spot ?? 999) - (b.equipment_spot ?? 999) ||
        warmUpOrder(a).localeCompare(warmUpOrder(b)),
    );
  } else if (kind === "stop") {
    list = [...bands].sort((a, b) => scratchedLast(a, b) || Number(!!stopsAt(a)) - Number(!!stopsAt(b)) || warmUpOrder(a).localeCompare(warmUpOrder(b)));
  } else {
    const inRound = roundSlots.map((s) => bands.find((b) => b.id === s.band_id)).filter((b): b is Band => !!b);
    const rest = round === "prelims" ? bands.filter((b) => !slotOf.has(b.id)) : [];
    list = [...inRound, ...rest].sort(scratchedLast);
  }

  const used = bands.filter((b) => b.equipment_spot != null);
  const lotSize = Math.max(event.equipment_spots ?? 0, ...used.map((b) => b.equipment_spot!));
  const counts = bands.reduce<Record<string, number>>((acc, b) => {
    const k = parking(b).key;
    return { ...acc, [k]: (acc[k] ?? 0) + 1 };
  }, {});
  const hereCount = bands.filter((b) => stopsAt(b)).length;

  return (
    <div>
      <AutoRefresh seconds={20} />
      <Link href={`/dashboard/events/${eventId}`} className="text-sm text-muted hover:text-foreground">
        ← Back to {event.name}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Contest day</h1>
      <p className="mt-1 text-sm text-muted">Updates every 20 seconds. Tap a button once; it saves right away.</p>

      {mine.length > 1 && (
        <nav aria-label="Check-in stations" className="-mx-4 mt-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex min-w-max gap-1 border-b border-border">
            {mine.map((c) => (
              <li key={c.id}>
                <Link
                  href={`${base}?station=${c.id}`}
                  scroll={false}
                  aria-current={c.id === station.id ? "page" : undefined}
                  className={`-mb-px flex flex-col border-b-2 px-4 py-2 text-sm ${
                    c.id === station.id ? "border-brand font-semibold text-foreground" : "border-transparent text-muted hover:text-foreground"
                  }`}
                >
                  <span className="whitespace-nowrap">
                    {path.indexOf(c) + 1}. {c.name}
                  </span>
                  <span className="text-xs font-normal text-muted">{kindLabel(c.checkpoint_kind)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {byRound && finals.length > 0 && (
        <div className="mt-4 inline-flex rounded-lg border border-border bg-surface p-1 text-sm">
          {(["prelims", "finals"] as const).map((r) => (
            <Link
              key={r}
              href={href(r === "finals" ? { round: r } : {})}
              scroll={false}
              aria-current={r === round ? "page" : undefined}
              className={`rounded-md px-4 py-1.5 ${r === round ? "bg-brand font-medium text-brand-foreground" : "text-muted"}`}
            >
              {r === "prelims" ? "Prelims" : "Finals"}
            </Link>
          ))}
        </div>
      )}

      {kind === "parking" ? (
        <Card className="mt-5 space-y-3 p-4">
          <p className="text-sm">
            <span className="font-semibold">{counts.all ?? 0}</span> all on-site ·{" "}
            <span className="font-semibold">{(counts.buses ?? 0) + (counts.equipment ?? 0)}</span> partly ·{" "}
            <span className="font-semibold">{counts.nothing ?? 0}</span> not here
            {counts.away ? ` · ${counts.away} away` : ""}
            {counts.left ? ` · ${counts.left} left` : ""}
          </p>
          <p className="text-sm">
            Equipment spots: <span className="font-semibold">{used.length}</span> used
            {event.equipment_spots ? ` of ${event.equipment_spots}` : ""}
            {event.equipment_spots && used.length >= event.equipment_spots && (
              <span className="font-semibold text-danger"> · The lot is full</span>
            )}
          </p>
          <Link
            href={href(view === "lot" ? {} : { view: "lot" })}
            scroll={false}
            className="inline-flex min-h-9 items-center rounded-md border border-border bg-surface px-3 text-sm font-medium hover:bg-background"
          >
            {view === "lot" ? "Show schools" : "Show the equipment lot"}
          </Link>
          {access.isHost && (
            <details>
              <summary className="cursor-pointer text-sm text-muted">Lot size</summary>
              <div className="mt-3">
                <LotSizeForm action={setEquipmentSpots.bind(null, eventId)} initial={event.equipment_spots} />
              </div>
            </details>
          )}
        </Card>
      ) : (
        <p className="mt-5 text-sm">
          <span className="font-semibold">{hereCount}</span> of {round === "finals" ? finals.length : bands.length} bands
          {kind === "gate" ? " at the gate so far" : ` checked in at ${station.name}`}
          {round === "finals" ? " (finals)" : ""}.
        </p>
      )}

      {kind === "parking" && view === "lot" ? (
        <ol className="mt-5 divide-y divide-border rounded-xl border border-border bg-surface">
          {lotSize === 0 && <li className="px-4 py-3 text-sm text-muted">No equipment has arrived yet.</li>}
          {Array.from({ length: lotSize }, (_, i) => i + 1).map((n) => {
            const b = bands.find((x) => x.equipment_spot === n);
            return (
              <li key={n} className="flex items-center gap-3 px-4 py-3">
                <span className="w-16 shrink-0 text-sm font-semibold">Spot {n}</span>
                {b ? (
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{b.school_name}</span>
                    <span className="block text-sm text-muted">
                      {[b.band_name, b.away_at ? "Away, coming back" : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                ) : (
                  <span className="flex-1 text-sm text-success">Free</span>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <ul className="mt-5 space-y-3">
          {list.length === 0 && (
            <Card>
              <p className="text-sm text-muted">
                {byRound ? "The performance order isn't published yet." : "No bands are registered yet."}
              </p>
            </Card>
          )}
          {list.map((b) => {
            const slot = slotOf.get(b.id);
            const here = stopsAt(b);
            const performed = kind === "gate" ? stopsAt(b, true) : undefined;
            const tap = (action: BandActionName) =>
              bandAction.bind(null, eventId, b.id, action, station.id, byRound ? round : null);
            const done = (text: string) => (
              <p className="flex min-h-11 items-center rounded-md bg-background px-3 text-sm text-muted">✓ {text}</p>
            );
            const status = kind === "parking" ? parking(b) : whereIs(b, stops, path, round);
            // When this station expects the band, from its schedule (parking and check-in points have no time).
            const due =
              kind === "warm_up" && slot?.warm_up_at
                ? `Warm-up ${time(slot.warm_up_at)}`
                : kind === "gate" && slot?.perform_at
                  ? `Ready ${time(minus(slot.perform_at, readyMinutes))} · Performs ${time(slot.perform_at)}`
                  : slot?.perform_at
                    ? `Performs ${time(slot.perform_at)}`
                    : null;
            return (
              <li key={b.id}>
                <Card className={`space-y-3 p-4 ${b.scratched_at ? "opacity-60" : ""}`}>
                  <div className="flex items-start gap-3">
                    <Pin tone={b.scratched_at ? "neutral" : status.tone} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-tight">{b.school_name}</p>
                      <p className="text-sm text-muted">
                        {b.band_name} · {b.classification}
                        {slot ? ` · ${round === "finals" ? "F" : "#"}${slot.order}` : ""}
                      </p>
                      <p className="mt-1 text-sm font-medium">{b.scratched_at ? "Scratched" : status.label}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      {b.equipment_spot != null && <Badge tone="brand">Spot {b.equipment_spot}</Badge>}
                      {due && <p className="mt-1 max-w-36 text-sm tabular-nums text-muted">{due}</p>}
                      {kind === "warm_up" && slot?.warm_up_location && <p className="text-sm text-muted">{slot.warm_up_location}</p>}
                    </div>
                  </div>

                  {kind === "parking" && vehicles(b) && <p className="text-sm text-muted">Expected: {vehicles(b)}</p>}

                  {!b.scratched_at && (
                    <div className="grid grid-cols-2 gap-2">
                      {kind === "parking" && (
                        <>
                          {(b.bus_count > 0 || !hasEquipment(b)) &&
                            (b.buses_at ? (
                              done(`${b.bus_count > 0 ? "Buses" : "Arrived"} ${time(b.buses_at)}`)
                            ) : (
                              // No vehicles on the registration: one "Arrived" tap.
                              <TapButton action={tap("buses_here")} variant="go">
                                {b.bus_count > 0 ? "Buses here" : "Arrived"}
                              </TapButton>
                            ))}
                          {hasEquipment(b) &&
                            (b.equipment_at ? (
                              done(b.equipment_spot != null ? `Equipment · Spot ${b.equipment_spot}` : `Equipment ${time(b.equipment_at)}`)
                            ) : (
                              <TapButton action={tap("equipment_here")} variant="go">
                                Equipment here
                              </TapButton>
                            ))}
                          {(b.buses_at || b.equipment_at) &&
                            !b.left_at &&
                            (b.away_at ? (
                              <TapButton action={tap("back")} variant="go">
                                Back on-site
                              </TapButton>
                            ) : (
                              <TapButton action={tap("away")} variant="secondary">
                                Away, coming back
                              </TapButton>
                            ))}
                          {(b.buses_at || b.equipment_at) &&
                            (b.left_at ? (
                              done(`Left ${time(b.left_at)}`)
                            ) : (
                              <TapButton
                                action={tap("left")}
                                variant="danger"
                                confirmMessage={`${b.school_name} has left for the day?${b.equipment_spot != null ? ` Spot ${b.equipment_spot} will be freed.` : ""}`}
                              >
                                Left for the day
                              </TapButton>
                            ))}
                        </>
                      )}
                      {kind !== "parking" &&
                        (here ? (
                          <div className={kind === "gate" ? "" : "col-span-2"}>{done(`Here ${time(here.reached_at)}`)}</div>
                        ) : (
                          <TapButton action={tap("here")} variant="go" className={kind === "gate" ? "" : "col-span-2"}>
                            Here
                          </TapButton>
                        ))}
                      {kind === "gate" &&
                        (performed ? (
                          done(`Performed ${time(performed.reached_at)}`)
                        ) : (
                          <TapButton action={tap("performed")} variant={here ? "go" : "secondary"}>
                            Performed
                          </TapButton>
                        ))}
                    </div>
                  )}

                  <BandNotes band={b} notes={notesBy.get(b.id) ?? []} eventId={eventId} userId={user.id} canManage={access.canManage} time={time} />

                  <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
                    <details className="min-w-0 flex-1">
                      <summary className="cursor-pointer text-muted">Add note</summary>
                      <div className="mt-2">
                        <NoteForm action={addBandNote.bind(null, eventId, b.id)} />
                      </div>
                    </details>
                    {access.canManage && (
                      <TapButton
                        action={bandAction.bind(null, eventId, b.id, b.scratched_at ? "unscratched" : "scratched", null, null)}
                        variant="ghost"
                        confirmMessage={b.scratched_at ? `Put ${b.school_name} back in?` : `Scratch ${b.school_name}? They'll show as withdrawn.`}
                        className="shrink-0 [&_button]:min-h-8 [&_button]:px-2 [&_button]:text-xs"
                      >
                        {b.scratched_at ? "Un-scratch" : "Scratch"}
                      </TapButton>
                    )}
                  </div>

                  <LastTap band={b} last={lastBy.get(b.id)} path={path} eventId={eventId} userId={user.id} canManage={access.canManage} time={time} />
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function BandNotes({
  band: b,
  notes,
  eventId,
  userId,
  canManage,
  time,
}: {
  band: Band;
  notes: Note[];
  eventId: string;
  userId: string;
  canManage: boolean;
  time: (iso: string) => string;
}) {
  if (!b.contest_day_conflicts && !b.special_needs && notes.length === 0) return null;
  return (
    <ul className="space-y-1.5 border-t border-border pt-3 text-sm">
      {b.contest_day_conflicts && (
        <li>
          <span className="font-medium">From the director:</span> {b.contest_day_conflicts}
        </li>
      )}
      {b.special_needs && (
        <li>
          <span className="font-medium">Accessibility (hosts only):</span> {b.special_needs}
        </li>
      )}
      {notes.map((n) => (
        <li key={n.id} className="flex items-start gap-2">
          <span className="min-w-0 flex-1">
            📝 {n.body}{" "}
            <span className="text-muted">
              · {n.created_by === userId ? "You" : (n.author_name ?? "Team")}, {time(n.created_at)}
            </span>
          </span>
          {(n.created_by === userId || canManage) && (
            <TapButton
              action={deleteBandNote.bind(null, eventId, n.id)}
              variant="ghost"
              confirmMessage="Delete this note?"
              className="shrink-0 [&_button]:min-h-8 [&_button]:px-2 [&_button]:text-xs"
            >
              Delete
            </TapButton>
          )}
        </li>
      ))}
    </ul>
  );
}

/** "Last: Here at Warm-up · Lee, 9:05 AM", with Undo for the person who tapped it (or a manager). */
function LastTap({
  band: b,
  last,
  path,
  eventId,
  userId,
  canManage,
  time,
}: {
  band: Band;
  last: Activity | undefined;
  path: Checkpoint[];
  eventId: string;
  userId: string;
  canManage: boolean;
  time: (iso: string) => string;
}) {
  if (!last) return null;
  const at = last.action === "here" || last.action === "performed" ? path.find((c) => c.id === last.station_id)?.name : undefined;
  const label = `${ACTION_LABEL[last.action] ?? last.action}${at ? ` at ${at}` : ""}${last.round === "finals" ? " (finals)" : ""}`;
  return (
    <div className="flex items-center justify-between gap-2 border-t border-border pt-2 text-xs text-muted">
      <span className="min-w-0">
        Last: {label}
        {last.detail ? ` · ${last.detail}` : ""} · {last.created_by === userId ? "You" : (last.actor_name ?? "Team")},{" "}
        {time(last.created_at)}
      </span>
      {(last.created_by === userId || canManage) && (
        <TapButton
          action={undoBandAction.bind(null, eventId, b.id)}
          variant="ghost"
          confirmMessage={`Undo "${label}" for ${b.school_name}?`}
          className="shrink-0 [&_button]:min-h-8 [&_button]:px-2 [&_button]:text-xs [&_button]:underline"
        >
          Undo
        </TapButton>
      )}
    </div>
  );
}

/** The map-pin status marker: red nothing here, gold partly, green all here. */
function Pin({ tone }: { tone: Tone }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`mt-0.5 h-6 w-6 shrink-0 ${PIN[tone]}`} fill="currentColor">
      <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
    </svg>
  );
}

function groupBy<T>(items: T[], key: (t: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(key(item), [...(map.get(key(item)) ?? []), item]);
  return map;
}
