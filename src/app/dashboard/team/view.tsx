import Link from "next/link";
import type { ReactNode } from "react";
import { LineIcon } from "@/components/line-icon";
import { Badge, Card } from "@/components/ui";
import { brand } from "@/lib/brand";
import { formatPhone } from "@/lib/phone";
import { CO_HOST_POWERS, REMOVAL_NOTE } from "@/lib/team-words";
import { formatDate } from "@/lib/time";
import {
  cancelTeamInvitation,
  inviteAgain,
  inviteCoHost,
  leaveEvent,
  removeAccountCoHost,
  removeFromEvents,
  resendTeamInvitation,
} from "../team-actions";
import { personName, type HostView, type Invite, type LeadView, type MyRole, type MyTeam, type Person, type Removal, type RoleOn, type StaffRole, type TeamEvent } from "./load";
import { CopyInviteLink, InviteAgainButton, InviteCoHostButton, RemovePersonButton, RowButton, type RemoveChoice } from "./team-ui";

const ROLE: Record<StaffRole | "co_host", string> = { volunteer_director: "Volunteer Lead", section_lead: "Coordinator", co_host: "Co-host" };
const short = (date: string) => formatDate(date.slice(0, 10), { year: undefined });
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const first = (name: string) => name.split(/[\s@]/)[0] || name;
const LINK = "font-medium text-brand underline underline-offset-4";
const askUs = (subject: string, words: string) => (
  <a href={`mailto:${brand.supportEmail}?subject=${encodeURIComponent(subject)}`} className={LINK}>
    {words}
  </a>
);

/** My team, for whoever's looking: hosts and co-hosts, Volunteer Leads, and their own roles. */
export function MyTeamView({ team }: { team: MyTeam }) {
  return (
    <div className="space-y-10">
      {team.host ? (
        <HostSections view={team.host} me={team.me} />
      ) : team.lead ? (
        <LeadSections view={team.lead} />
      ) : (
        <header>
          <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">My team</h1>
          <p className="mt-2 text-muted">
            {team.myRoles.length
              ? "The events you help run. You can leave an event here."
              : "You're not on an event's team right now. When someone invites you to help run an event, it shows here."}
          </p>
        </header>
      )}
      {team.myRoles.length > 0 && <MyRoles roles={team.myRoles} other={!!team.host} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Hosts and co-hosts
// ---------------------------------------------------------------------------------------------

function HostSections({ view, me }: { view: HostView; me: string }) {
  const { org, spots, isAccountHost } = view;
  const full = spots.max !== null && spots.used >= spots.max;
  const invitations = spots.invited ? `, including ${plural(spots.invited, "invitation", "invitations")}` : "";
  const fullWords = `Your ${spots.plan ?? ""} plan includes ${spots.max} team spots, and invitations count until they're accepted. Remove someone or cancel an invitation to free a spot, or `;
  const justYou = view.hosts.length === 1 && !view.coHostInvites.length && !view.people.length && !view.eventInvites.length;
  const canAddStaff = spots.eventStaff && !full;
  const accountHostName = view.accountHost ? personName(view.accountHost.profile) : "the Account Host";

  return (
    <>
      <header>
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">My team</h1>
        <p className="mt-2 text-muted">
          Everyone who helps run {org.name}&apos;s events.{" "}
          {spots.max !== null ? (
            <>
              <strong className="font-semibold text-foreground">
                {spots.used} of {spots.max}
              </strong>{" "}
              team spots on the {spots.plan} plan{invitations}.
            </>
          ) : (
            <>
              {plural(spots.used, "person", "people")} on the team{invitations}.
            </>
          )}
        </p>
        {full && (
          <p role="status" className="mt-4 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm leading-6">
            <strong className="font-semibold">Your team is full.</strong> {fullWords}
            {askUs("A bigger team", "ask us about a bigger team")}.
          </p>
        )}
      </header>

      <section aria-labelledby="hosts-heading" className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 id="hosts-heading" className="text-xl font-semibold">
            Hosts
          </h2>
          {isAccountHost && (
            <InviteCoHostButton
              action={inviteCoHost.bind(null, org.id)}
              powers={CO_HOST_POWERS}
              blockedBy={full ? "Your team is full" : null}
              spotNote={
                spots.max !== null
                  ? `We'll email them a link that works for 30 days. The invitation holds 1 of your ${spots.max} team spots until it's accepted (${spots.used} in use now).`
                  : "We'll email them a link that works for 30 days."
              }
            />
          )}
        </div>
        <p className="text-sm leading-6 text-muted">
          {CO_HOST_POWERS}
          {!isAccountHost && <> Your Account Host is {accountHostName}.</>}
        </p>
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {view.hosts.map((h) => {
            const name = personName(h.profile);
            const you = h.userId === me;
            return (
              <Row
                key={h.userId}
                title={
                  <>
                    {name}
                    {you && " (you)"} <Badge tone="info">{h.role === "owner" ? "Account Host" : "Co-host"}</Badge>
                  </>
                }
                detail={[h.profile.email, formatPhone(h.profile.phone), h.role === "admin" ? "Every event" : null]}
                actions={
                  h.role === "admin" && you ? (
                    <RowButton
                      action={removeAccountCoHost.bind(null, org.id, h.userId, name)}
                      pendingText="Leaving…"
                      confirm={`Stop being a co-host? You lose access to every ${org.name} event right away. To come back, ask ${accountHostName} to invite you again.`}
                      confirmLabel="Stop being a co-host"
                    >
                      Stop being a co-host
                    </RowButton>
                  ) : h.role === "admin" && isAccountHost ? (
                    <RowButton
                      action={removeAccountCoHost.bind(null, org.id, h.userId, name)}
                      pendingText="Removing…"
                      label={`Remove ${name}`}
                      confirm={`Remove ${name} as co-host? ${first(name)} loses access to every event right away, and stops leading any jobs. A team spot opens up. We don't email ${first(name)}. You can invite them again from Removed recently.`}
                      confirmLabel="Remove co-host"
                    >
                      Remove…
                    </RowButton>
                  ) : null
                }
              />
            );
          })}
          {view.coHostInvites.map((inv) => (
            <InviteRow key={inv.id} invite={inv} manage={isAccountHost} what="Co-host" />
          ))}
        </ul>
      </section>

      {justYou ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">It&apos;s just you so far</h2>
          <p className="text-sm leading-6">
            A co-host shares the whole load: every event, start to finish. For one event, add a Volunteer Lead to run volunteers, or Coordinators to
            lead single jobs like parking or the gate.
          </p>
          <AddStaffLinks view={view} canAdd={canAddStaff} />
        </Card>
      ) : (
        <section aria-labelledby="event-teams-heading" className="space-y-3">
          <h2 id="event-teams-heading" className="text-xl font-semibold">
            Event teams
          </h2>
          <p className="text-sm leading-6 text-muted">
            Volunteer Leads run volunteers for one event. Coordinators lead one job on the day, like parking or the gate. Each holds a team spot until
            their event is over.
          </p>
          {view.people.length || view.eventInvites.length ? (
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
              {view.people.map((p) => (
                <PersonRow key={p.userId} person={p} orgId={org.id} />
              ))}
              {view.eventInvites.map((inv) => (
                <InviteRow key={inv.id} invite={inv} manage what={ROLE[inv.role ?? "section_lead"]} />
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted">No Volunteer Leads or Coordinators on upcoming events.</p>
          )}
          <AddStaffLinks view={view} canAdd={canAddStaff} />
        </section>
      )}

      {view.past.length > 0 && (
        <section aria-labelledby="past-heading" className="space-y-3">
          <h2 id="past-heading" className="text-xl font-semibold">
            Past events
          </h2>
          <p className="text-sm leading-6 text-muted">Helpers whose events are over. They don&apos;t hold a team spot, and can&apos;t see those events anymore.</p>
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {view.past.map((p) => {
              const last = p.roles[p.roles.length - 1];
              return (
                <Row
                  key={p.userId}
                  title={personName(p.profile)}
                  detail={[p.profile.email]}
                  actions={
                    canAddStaff ? (
                      <InviteAgainButton
                        email={p.profile.email}
                        roleLabel={ROLE[last.role]}
                        events={view.upcoming}
                        action={inviteAgain.bind(null, org.id, p.profile.email, last.role)}
                      />
                    ) : null
                  }
                >
                  <RoleLines roles={p.roles} />
                </Row>
              );
            })}
          </ul>
        </section>
      )}

      <RemovedRecently
        removed={view.removed}
        orgId={org.id}
        events={view.upcoming}
        canInvite={(r) => !full && (r.role === "co_host" ? isAccountHost : spots.eventStaff)}
      />

      <PrivacyNote>Only {org.name}&apos;s hosts and co-hosts see this page&apos;s emails and phone numbers. {REMOVAL_NOTE}</PrivacyNote>
    </>
  );
}

/** Who sees the people's details on this page, and what removing does. */
function PrivacyNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm leading-6 text-muted">
      <LineIcon name="lock" className="mt-1 size-4" />
      <span>{children}</span>
    </p>
  );
}

/** Where Volunteer Leads and Coordinators are added: each event's team setup. */
function AddStaffLinks({ view, canAdd }: { view: HostView; canAdd: boolean }) {
  if (!view.spots.eventStaff) {
    return (
      <p className="text-sm leading-6">
        Your {view.spots.plan} plan doesn&apos;t include Volunteer Leads or Coordinators. {askUs("Volunteer Leads and Coordinators", "Ask us about a plan that does")}.
      </p>
    );
  }
  if (!canAdd) return <p className="text-sm leading-6 text-muted">Free a team spot to add a Volunteer Lead or Coordinator.</p>;
  if (!view.upcoming.length) {
    return (
      <p className="text-sm leading-6">
        Volunteer Leads and Coordinators join one event.{" "}
        <Link href="/dashboard/events/new" className={LINK}>
          Create an event
        </Link>{" "}
        to add them.
      </p>
    );
  }
  return (
    <p className="text-sm leading-7">
      Add a Volunteer Lead or Coordinator from an event&apos;s team setup:{" "}
      {view.upcoming.map((e, i) => (
        <span key={e.id}>
          {i > 0 && " · "}
          <Link href={`/dashboard/events/${e.id}/edit?section=team`} className={LINK}>
            {e.name}
          </Link>
        </span>
      ))}
    </p>
  );
}

/** One Volunteer Lead or Coordinator, every role they have, and one "Remove…". */
function PersonRow({ person, orgId }: { person: Person; orgId: string }) {
  const name = personName(person.profile);
  const choices: RemoveChoice[] = person.roles.map((r) => ({
    value: `${r.event.id}:${r.role}`,
    label: `${ROLE[r.role]} of ${r.event.name}`,
    leaves: leftEmpty(r),
  }));
  return (
    <Row
      title={name}
      detail={[person.profile.email, formatPhone(person.profile.phone)]}
      actions={<RemovePersonButton name={name} firstName={first(name)} choices={choices} action={removeFromEvents.bind(null, orgId, person.userId, name)} />}
    >
      <RoleLines roles={person.roles} link={(e) => `/dashboard/events/${e.id}/edit?section=team`} />
    </Row>
  );
}

/** What removing this role leaves without anyone. */
function leftEmpty(r: RoleOn) {
  if (r.role === "volunteer_director") return r.soleLead ? [`${r.event.name} will have no Volunteer Lead. Its hosts run volunteers.`] : [];
  return r.soleJobs.map((job) => `${job} at ${r.event.name} will need a new Coordinator.`);
}

function RoleLines({ roles, link }: { roles: RoleOn[]; link?: (e: TeamEvent) => string }) {
  return (
    <ul className="mt-2 space-y-1 text-sm leading-6">
      {roles.map((r) => (
        <li key={`${r.event.id}:${r.role}`}>
          <strong className="font-semibold">{ROLE[r.role]}</strong> ·{" "}
          {link ? (
            <Link href={link(r.event)} className={LINK}>
              {r.event.name}
            </Link>
          ) : (
            r.event.name
          )}{" "}
          <span className="text-muted">
            {short(r.event.starts_on)}
            {r.event.ended && " · Ended"}
            {r.jobs.length > 0 && ` · leads ${r.jobs.join(", ")}`}
          </span>
        </li>
      ))}
    </ul>
  );
}

function InviteRow({ invite: inv, manage, what }: { invite: Invite; manage: boolean; what: string }) {
  return (
    <Row
      title={
        <>
          <span className="break-all">{inv.email}</span> <Badge tone="warning">Invited</Badge>
        </>
      }
      detail={[
        inv.event ? `${what} · ${inv.event.name} ${short(inv.event.starts_on)}` : what,
        inv.job ? `to lead ${inv.job}` : null,
        `Invited ${short(inv.createdAt)}`,
        inv.expired ? `Link expired ${short(inv.expiresAt)}` : `Link works until ${short(inv.expiresAt)}`,
      ]}
      actions={
        <>
          {manage && (
            <RowButton action={resendTeamInvitation.bind(null, inv.id)} pendingText="Sending…" label={`Resend the invitation to ${inv.email}`}>
              Resend
            </RowButton>
          )}
          <CopyInviteLink url={inv.link} />
          {manage && (
            <RowButton
              action={cancelTeamInvitation.bind(null, inv.id)}
              pendingText="Cancelling…"
              label={`Cancel the invitation for ${inv.email}`}
              confirm={`Cancel the invitation for ${inv.email}? Their link stops working, and the team spot it holds is free.`}
              confirmLabel="Cancel invitation"
            >
              Cancel invitation
            </RowButton>
          )}
        </>
      }
    />
  );
}

function RemovedRecently({
  removed,
  orgId,
  events,
  canInvite,
}: {
  removed: Removal[];
  orgId: string;
  events: TeamEvent[];
  canInvite: (r: Removal) => boolean;
}) {
  if (!removed.length) return null;
  return (
    <details className="group rounded-lg border border-border bg-surface">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 [&::-webkit-details-marker]:hidden">
        <span className="font-semibold">Removed recently · {removed.length}</span>
        <span className="text-sm font-medium text-muted">
          <span className="group-open:hidden">Show</span>
          <span className="hidden group-open:inline">Hide</span>
        </span>
      </summary>
      <p className="border-t border-border px-4 pt-3 text-sm text-muted">The last 90 days. They can&apos;t see the account&apos;s events.</p>
      <ul className="divide-y divide-border">
        {removed.map((r) => (
          <Row
            key={r.id}
            title={r.name}
            detail={[
              r.name !== r.email ? r.email : null,
              r.event ? `${ROLE[r.role]} · ${r.event.name}` : ROLE[r.role],
              `${r.left ? "Left" : "Removed"} ${short(r.removedAt)}`,
            ]}
            actions={
              canInvite(r) ? (
                <InviteAgainButton
                  email={r.email}
                  roleLabel={ROLE[r.role]}
                  events={r.role === "co_host" ? null : events}
                  defaultEventId={r.event?.id}
                  action={inviteAgain.bind(null, orgId, r.email, r.role)}
                />
              ) : null
            }
          />
        ))}
      </ul>
    </details>
  );
}

// ---------------------------------------------------------------------------------------------
// Volunteer Leads: their events' Coordinators
// ---------------------------------------------------------------------------------------------

function LeadSections({ view }: { view: LeadView }) {
  const upcoming = view.events.map((e) => e.event);
  return (
    <>
      <header>
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">My team</h1>
        <p className="mt-2 text-muted">Coordinators on the events where you&apos;re the Volunteer Lead.</p>
      </header>
      {view.events.map(({ event, coordinators, invites }) => (
        <section key={event.id} aria-labelledby={`event-${event.id}`} className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id={`event-${event.id}`} className="text-xl font-semibold">
              {event.name}
            </h2>
            <span className="text-sm text-muted">{short(event.starts_on)}</span>
          </div>
          {coordinators.length || invites.length ? (
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
              {coordinators.map((p) => {
                const name = personName(p.profile);
                const role = p.roles[0];
                return (
                  <Row
                    key={p.userId}
                    title={
                      <>
                        {name} <Badge tone="info">Coordinator</Badge>
                      </>
                    }
                    detail={[p.profile.email, formatPhone(p.profile.phone), role?.jobs.length ? `leads ${role.jobs.join(", ")}` : "No job yet"]}
                    actions={
                      role && (
                        <RemovePersonButton
                          name={name}
                          firstName={first(name)}
                          choices={[{ value: `${event.id}:section_lead`, label: `Coordinator of ${event.name}`, leaves: leftEmpty(role) }]}
                          action={removeFromEvents.bind(null, "", p.userId, name)}
                        />
                      )
                    }
                  />
                );
              })}
              {invites.map((inv) => (
                <InviteRow key={inv.id} invite={{ ...inv, event: null }} manage what="Coordinator" />
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted">No Coordinators yet.</p>
          )}
          <p className="text-sm">
            <Link href={`/dashboard/events/${event.id}/volunteering`} className={LINK}>
              Add a Coordinator to a job in Volunteer setup
            </Link>
          </p>
        </section>
      ))}
      <RemovedRecently removed={view.removed} orgId="" events={upcoming} canInvite={() => true} />
      <PrivacyNote>Coordinators&apos; emails and phone numbers are seen by the event&apos;s hosts and Volunteer Leads. {REMOVAL_NOTE}</PrivacyNote>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Your own roles: leave an event
// ---------------------------------------------------------------------------------------------

function MyRoles({ roles, other }: { roles: MyRole[]; other: boolean }) {
  const hosts = [...new Map(roles.filter((r) => r.accountHost).map((r) => [r.accountHost!.email, r.accountHost!])).values()];
  return (
    <section aria-labelledby="my-roles-heading" className="space-y-3">
      <h2 id="my-roles-heading" className="text-xl font-semibold">
        {other ? "Your roles on other accounts' events" : "Your roles"}
      </h2>
      <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
        {roles.map((r) => (
          <Row
            key={`${r.event.id}:${r.role}`}
            title={
              <>
                {ROLE[r.role]} ·{" "}
                <Link href={`/dashboard/events/${r.event.id}`} className={LINK}>
                  {r.event.name}
                </Link>
              </>
            }
            detail={[short(r.event.starts_on), r.accountHost ? `Account Host: ${r.accountHost.name}` : null]}
            actions={
              <RowButton
                action={leaveEvent.bind(null, r.event.id, r.role, r.event.name)}
                pendingText="Leaving…"
                confirm={`Leave ${r.event.name}? You lose access to its volunteer pages right away${r.role === "section_lead" ? ", and stop leading your jobs" : ""}. To come back, ask ${r.accountHost?.name ?? "the Account Host"} to invite you again.`}
                confirmLabel="Leave this event"
              >
                Leave this event
              </RowButton>
            }
          />
        ))}
      </ul>
      {hosts.map((h) => (
        <p key={h.email} className="text-sm text-muted">
          Questions? Contact{" "}
          <a href={`mailto:${h.email}`} className={LINK}>
            {h.name}
          </a>
          , Account Host
        </p>
      ))}
    </section>
  );
}

/** One person or invitation: who, details, and buttons on the right (below on phones). */
function Row({ title, detail, actions, children }: { title: ReactNode; detail: (string | null | undefined)[]; actions?: ReactNode; children?: ReactNode }) {
  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-7">{title}</p>
        <p className="text-sm leading-6 text-muted">{detail.filter(Boolean).join(" · ")}</p>
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </li>
  );
}
