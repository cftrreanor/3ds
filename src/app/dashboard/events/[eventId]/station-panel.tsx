import { Badge, Card } from "@/components/ui";
import { kindLabel, type CheckpointKind } from "@/lib/contest-day";
import { hasBands, leadWords } from "@/lib/event-types";
import { formatPhone } from "@/lib/phone";
import { formatDate, formatDateRange, formatTimeRange, utcToZonedDate, utcToZonedTime } from "@/lib/time";
import {
  createItem,
  createShift,
  deleteItem,
  deleteShift,
  deleteStation,
  generateShifts,
  removeItemSignup,
  updateItem,
  updateShift,
  updateStation,
} from "../../actions";
import { BuildShifts, DeleteButton, ItemsEditor, ShiftForm, StationForm, type LeadOption } from "./forms";
import { inviteCoordinator } from "../../team-actions";

export type Shift = {
  id: string;
  station_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  max_capacity: number;
  registered_count: number;
};

export type Station = {
  id: string;
  name: string;
  checkpoint_kind: CheckpointKind | null;
  checkpoint_order: number | null;
  due_minutes_before_warm_up: number | null;
  location: string | null;
  instructions: string | null;
  adults_only?: boolean;
  zone?: string | null;
  lead_user_id: string | null;
  /** Everyone leading this sign-up, first-added first. */
  lead_ids: string[];
  /** When "1. Sign-up details" was last saved (null: not done yet). */
  details_saved_at?: string | null;
  /** Time slots (shifts) or things to bring (items). */
  signup_kind?: "shifts" | "items";
};

/** One thing an items sign-up needs (Desserts, 6 needed). */
export type StationItem = { id: string; station_id: string; name: string; needed: number; claimed_count: number };

/** Who's bringing what, for the event's volunteer managers. */
export type ItemSignup = { id: string; item_id: string; note: string | null; volunteer_name: string; email: string | null; phone: string | null };

export type RosterEntry = {
  assignment_id: string;
  shift_id: string;
  volunteer_name: string;
  email: string | null;
  phone: string | null;
  checked_in_at: string | null;
  contact_locked: boolean;
  /** Under 18 / a student: their phone is a guardian's. */
  minor?: boolean;
  /** Who signed them up, if someone else did. */
  signed_up_by?: string | null;
};

/**
 * One station: its shifts (with editing for organizers), and for the sign-up's
 * lead, who's signed up. Used on the Volunteer Setup tabs and, for
 * Coordinators, on the event page.
 */
export function StationPanel({
  eventId,
  station,
  stationShifts,
  event,
  days,
  windowLabel,
  userId,
  canManage,
  leadNames,
  roster,
  locations = [],
  zones,
  items = [],
  itemSignups,
  kindLocked = null,
  leadOptions = [],
  pendingInvites = [],
}: {
  eventId: string;
  station: Station;
  stationShifts: Shift[];
  event: { timezone: string; starts_on: string; ends_on: string; event_type?: string };
  days: string[];
  windowLabel: string;
  userId: string;
  canManage: boolean;
  leadNames: string[];
  /** A group event's rooms, suggested for a sign-up's location. */
  locations?: string[];
  /** A fair's zones, suggested for a sign-up's zone. */
  zones?: readonly string[];
  /** Only for the sign-up's lead: who has signed up. */
  roster?: RosterEntry[];
  /** An items station: what it needs. */
  items?: StationItem[];
  /** An items station, for managers and its leads: who's bringing what. */
  itemSignups?: ItemSignup[];
  /** Why its type can't change right now (it has shifts or items, or it's a check-in stop). */
  kindLocked?: string | null;
  /** The team, to pick its Coordinators from. */
  leadOptions?: LeadOption[];
  /** Invited to lead it, not accepted yet. */
  pendingInvites?: string[];
}) {
  const itemsStation = station.signup_kind === "items";
  const tz = event.timezone;
  const multiDay = days.length > 1;
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{station.name}</h3>
            {station.checkpoint_kind && (
              <Badge tone="info">
                Check-in stop {station.checkpoint_order} · {kindLabel(station.checkpoint_kind)}
              </Badge>
            )}
            {station.adults_only && <Badge>Adults only (18+)</Badge>}
            {station.lead_ids.includes(userId) && <Badge tone="brand">You lead this</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted">
            {[station.location, leadNames.length ? `${leadNames.length > 1 ? "Leads" : "Lead"}: ${leadNames.join(", ")}` : canManage ? "No lead yet" : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      {canManage && (
        // Everything about the sign-up in one place: its name, type, details, and Coordinators (one Save),
        // then its items or time slots, edited right in their rows.
        <div className="mt-5 space-y-8">
          <div id="station-details" className="scroll-mt-6">
            <StationForm
              action={updateStation.bind(null, eventId, station.id)}
              initial={station}
              submitLabel="Save sign-up"
              bands={hasBands(event.event_type)}
              locations={locations}
              zones={zones}
              leadLabel={leadWords(event.event_type).many}
              kind={{ value: station.signup_kind ?? "shifts", locked: kindLocked }}
              coordinators={{ options: leadOptions, pending: pendingInvites, invite: inviteCoordinator.bind(null, eventId, station.id) }}
              trackUnsaved
            />
          </div>
          {itemsStation ? (
            <section id="items" aria-labelledby="items-heading" className="scroll-mt-6 border-t border-border pt-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 id="items-heading" className="text-base font-semibold">
                  Items to bring
                </h4>
                <p className="text-sm text-muted">Sign-ups stop when an item is covered</p>
              </div>
              <div className="mt-3">
                <ItemsEditor
                  create={createItem.bind(null, eventId, station.id)}
                  items={items.map((it) => ({
                    ...it,
                    update: updateItem.bind(null, eventId, it.id),
                    remove: deleteItem.bind(null, eventId, it.id),
                  }))}
                />
              </div>
            </section>
          ) : (
            <section id="build-shifts" aria-labelledby="shifts-heading" className="scroll-mt-6 border-t border-border pt-6">
              <h4 id="shifts-heading" className="text-base font-semibold">
                Time slots
              </h4>
              <ShiftList shifts={stationShifts} eventId={eventId} tz={tz} multiDay={multiDay} days={days} canManage />
              <div className="mt-4">
                <BuildShifts
                  generate={generateShifts.bind(null, eventId, station.id)}
                  create={createShift.bind(null, eventId, station.id)}
                  windowLabel={windowLabel}
                  days={days}
                  existing={stationShifts.length}
                  signedUp={stationShifts.some((s) => s.registered_count > 0)}
                />
              </div>
            </section>
          )}
        </div>
      )}
      {itemsStation ? (
        <ItemsBoard items={items} signups={itemSignups} eventId={eventId} canManage={canManage} />
      ) : (
        !canManage && (
          <>
            <h4 className="mt-6 text-sm font-semibold">Shift schedule</h4>
            <ShiftList shifts={stationShifts} eventId={eventId} tz={tz} multiDay={multiDay} days={days} canManage={false} />
          </>
        )
      )}

      {roster && !itemsStation && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold">{canManage ? "Who's signed up" : "Your volunteers"}</h4>
          {roster.length === 0 ? (
            <p className="mt-1 text-sm text-muted">No one has signed up yet.</p>
          ) : (
            <>
              {roster[0].contact_locked && (
                <p className="mt-1 text-sm text-muted">
                  Phone numbers and emails unlock on event day ({formatDateRange(event.starts_on, event.ends_on)}).
                </p>
              )}
              <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
                {roster.map((v) => {
                  const shift = stationShifts.find((s) => s.id === v.shift_id);
                  return (
                    <li key={v.assignment_id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{v.volunteer_name}</p>
                        {shift && <p className="truncate text-sm text-muted">{formatTimeRange(shift.starts_at, shift.ends_at, tz)}</p>}
                        {v.phone && (
                          <a href={`tel:${v.phone}`} className="text-sm font-medium text-brand hover:underline">
                            {formatPhone(v.phone)}
                          </a>
                        )}
                      </div>
                      <span className="shrink-0 text-sm">
                        {v.checked_in_at ? "✓ Arrived" : <span className="text-muted">Not yet</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}

      {canManage && (
        <div className="mt-8 border-t border-border pt-4">
          <DeleteButton
            action={deleteStation.bind(null, eventId, station.id)}
            label={`Delete sign-up ${station.name}`}
            text="Delete sign-up"
            quiet
            confirmMessage={`Delete “${station.name}”? Its time slots and items are deleted too, and this can't be undone. (A sign-up with people signed up can't be deleted.)`}
          />
        </div>
      )}
    </Card>
  );
}

/** A sign-up's time slots: when, how full, and (for organizers) edit or delete each one. */
function ShiftList({
  shifts,
  eventId,
  tz,
  multiDay,
  days,
  canManage,
}: {
  shifts: Shift[];
  eventId: string;
  tz: string;
  multiDay: boolean;
  days: string[];
  canManage: boolean;
}) {
  if (shifts.length === 0) return <p className="mt-2 text-sm text-muted">No time slots yet.</p>;
  return (
    <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
      {shifts.map((s) => (
        <li key={s.id} className="px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{s.title}</p>
              <p className="text-sm text-muted">
                {multiDay && `${formatDate(utcToZonedDate(s.starts_at, tz), { year: undefined })} · `}
                {formatTimeRange(s.starts_at, s.ends_at, tz)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className="mr-1 text-sm tabular-nums text-muted">
                {s.registered_count} / {s.max_capacity} filled
              </span>
              {canManage && (
                <DeleteButton action={deleteShift.bind(null, eventId, s.id)} label={`Delete shift ${s.title}`} confirmMessage={`Delete “${s.title}”?`} />
              )}
            </div>
          </div>
          {canManage && (
            <details className="mt-1">
              <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-muted hover:text-foreground">
                Edit time slot
              </summary>
              <div className="mt-3 pb-1">
                <ShiftForm
                  action={updateShift.bind(null, eventId, s.id)}
                  days={days}
                  registered={s.registered_count}
                  submitLabel="Save time slot"
                  initial={{
                    title: s.title,
                    day: utcToZonedDate(s.starts_at, tz),
                    startTime: utcToZonedTime(s.starts_at, tz),
                    endTime: utcToZonedTime(s.ends_at, tz),
                    capacity: s.max_capacity,
                    description: s.description,
                  }}
                />
              </div>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}

/** An items station: each item, how many are coming, and who's bringing what (with their note). */
function ItemsBoard({
  items,
  signups,
  eventId,
  canManage,
}: {
  items: StationItem[];
  signups?: ItemSignup[];
  eventId: string;
  canManage: boolean;
}) {
  return (
    <>
      <h4 className="mt-6 text-sm font-semibold">Who&apos;s bringing what</h4>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No items yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
          {items.map((it) => {
            const people = (signups ?? []).filter((s) => s.item_id === it.id);
            return (
              <li key={it.id} className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{it.name}</p>
                  <span className="text-sm tabular-nums text-muted">
                    {it.claimed_count} / {it.needed} coming
                  </span>
                </div>
                {signups && people.length > 0 && (
                  <ul className="mt-1 space-y-1">
                    {people.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="min-w-0">
                          <span className="font-medium">{p.volunteer_name}</span>
                          {p.note && <span className="text-muted"> · {p.note}</span>}
                          {(p.email || p.phone) && (
                            <span className="block text-muted">{[p.email, formatPhone(p.phone)].filter(Boolean).join(" · ")}</span>
                          )}
                        </span>
                        {canManage && (
                          <DeleteButton
                            action={removeItemSignup.bind(null, eventId, p.id)}
                            label={`Take ${p.volunteer_name} off ${it.name}`}
                            text="Remove"
                            confirmMessage={`Take ${p.volunteer_name} off “${it.name}”? Their spot opens up again. We don't email them, so let them know.`}
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
