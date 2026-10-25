// What a host invitation can start someone on (20261224000000_invitation_plan.sql).
// District Command is left out for now.

import { packageLabel } from "@/lib/plan";

export const INVITE_PACKAGES = [
  { value: "free", label: "Free teacher plan" },
  { value: "schedule", label: "Schedule Command" },
  { value: "volunteer", label: "Volunteer Command" },
  { value: "event", label: "Event Command" },
] as const;

export const INVITE_STATUSES = [
  { value: "comped", label: "Free pilot" },
  { value: "trialing", label: "Trial" },
] as const;

export const isInvitePackage = (v: unknown): v is (typeof INVITE_PACKAGES)[number]["value"] => INVITE_PACKAGES.some((p) => p.value === v);
export const isInviteStatus = (v: unknown): v is (typeof INVITE_STATUSES)[number]["value"] => INVITE_STATUSES.some((s) => s.value === v);

export const invitePackageLabel = (code: string) => INVITE_PACKAGES.find((p) => p.value === code)?.label ?? packageLabel(code);
export const inviteStatusLabel = (code: string) => INVITE_STATUSES.find((s) => s.value === code)?.label ?? code;
