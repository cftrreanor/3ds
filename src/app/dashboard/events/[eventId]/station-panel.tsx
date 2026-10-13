import { Badge, Card } from "@/components/ui";
import { kindLabel, type CheckpointKind } from "@/lib/contest-day";
import { hasBands, leadWords } from "@/lib/event-types";
import { formatPhone } from "@/lib/phone";
import { formatDate, formatDateRange, formatTimeRange, utcToZonedDate, utcToZonedTime } from "@/lib/time";
import { createShift, deleteShift, deleteStation, generateShifts, updateShift, updateStation } from "../../actions";
import { BuildShifts, DeleteButton, ShiftForm, StationForm } from "./forms";
import { StepStatus } from "./volunteering/station-steps";

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
  /** Everyone leading this station, first-added first. */
  lead_ids: string[];
  /** When "1. Station details" was last saved (null: not done yet). */
  details_saved_at?: string | null;
};

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
 * One station: its shifts (with editing for organizers), and for the station's
 * lead, who's signed up. Used on the Volunteer Registration tabs and, for
 * Section Leads, on the event page.
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
  /** A group event's rooms, suggested for a station's location. */
  locations?: string[];
  /** A fair's zones, suggested for a station's zone. */
  zones?: readonly string[];
  /** Only for the station's lead: who has signed up. */
  roster?: RosterEntry[];
}) {
  const tz = event.timezone;
  const multiDay = days.length > 1;
  const detailsDone = Boolean(station.details_saved_at);
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
        {canManage && (
          <DeleteButton
            action={deleteStation.bind(null, eventId, station.id)}
            label={`Delete station ${station.name}`}
            text="Delete Station"
            destructive
            confirmMessage={`Delete “${station.name}”? Its shifts are deleted too, and this can't be undone. (A station with volunteers signed up can't be deleted.)`}
          />
        )}
      </div>

      {canManage && (
        <div className="mt-4 flex flex-col gap-3">
          <details id="station-details" className="group scroll-mt-6 rounded-lg border border-border px-4 py-3" open={!detailsDone}>
            <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-x-4 gap-y-1 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2 font-semibold">
                <span aria-hidden className="text-muted transition group-open:rotate-90">▸</span>
                1. Station details
              </span>
              <StepStatus done={detailsDone} />
            </summary>
            <p className="mt-2 text-sm text-muted">
              Where volunteers report and what they should know. Save to finish this step.
            </p>
            <div className="mt-4">
              <StationForm
                action={updateStation.bind(null, eventId, station.id)}
                initial={station}
                submitLabel="Save station details"
                bands={hasBands(event.event_type)}
                locations={locations}
                zones={zones}
                leadLabel={leadWords(event.event_type).many}
                trackUnsaved
              />
            </div>
          </details>
          <details id="build-shifts" className="group scroll-mt-6 rounded-lg border border-border px-4 py-3" open={stationShifts.length === 0}>
            <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-x-4 gap-y-1 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2 font-semibold">
                <span aria-hidden className="text-muted transition group-open:rotate-90">▸</span>
                2. Build shifts
              </span>
              <StepStatus done={stationShifts.length > 0} />
            </summary>
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
          </details>
        </div>
      )}
      <h4 className="mt-6 text-sm font-semibold">Shift schedule</h4>
      {stationShifts.length > 0 ? (
        <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
          {stationShifts.map((s) => (
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
                    <DeleteButton
                      action={deleteShift.bind(null, eventId, s.id)}
                      label={`Delete shift ${s.title}`}
                      confirmMessage={`Delete “${s.title}”?`}
                    />
                  )}
                </div>
              </div>
              {canManage && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs font-medium text-muted hover:text-foreground">
                    Edit shift
                  </summary>
                  <div className="mt-3 pb-1">
                    <ShiftForm
                      action={updateShift.bind(null, eventId, s.id)}
                      days={days}
                      registered={s.registered_count}
                      submitLabel="Save shift"
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
      ) : (
        <p className="mt-2 text-sm text-muted">No shifts yet.</p>
      )}

      {roster && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold">Your volunteers</h4>
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
                        <p className="truncate text-sm text-muted">
                          {shift ? formatTimeRange(shift.starts_at, shift.ends_at, tz) : ""}
                          {v.phone && (
                            <>
                              {" · "}
                              <a href={`tel:${v.phone}`} className="font-medium text-brand hover:underline">
                                {formatPhone(v.phone)}
                              </a>
                            </>
                          )}
                        </p>
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

    </Card>
  );
}
