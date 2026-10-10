import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { smallInput } from "../kit";
import { inviteHost } from "./actions";

/** Invite anyone to host by email (without a pilot request). */
export function InviteBox() {
  return (
    <ActionForm action={inviteHost.bind(null, null)} className="flex flex-wrap items-center gap-2">
      <input name="email" type="email" required placeholder="host@school.org" aria-label="Email to invite as a host" className={`${smallInput} w-56`} />
      <SubmitButton className="h-8 min-h-8! rounded-sm px-3" pendingText="Inviting…">
        Invite a host
      </SubmitButton>
    </ActionForm>
  );
}
