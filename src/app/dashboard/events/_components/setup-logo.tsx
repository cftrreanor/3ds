import { LogoForm } from "@/components/logo-form";

/**
 * The account's logo and color on a new event's first setup step, so a host
 * can set them from the start. They save on their own, as soon as they're picked.
 */
export function SetupLogo({ eventId, logo, color }: { eventId: string | null; logo: string | null; color: string | null }) {
  return (
    <fieldset>
      <legend className="mb-3 w-full border-b border-border pt-2 pb-1 font-semibold">Logo and color</legend>
      <p className="mb-3 text-sm text-muted">
        Optional. One logo for your account, shown next to ours at the top of your public event pages and printed on
        volunteer badges. It saves as soon as you upload it, and you can change it later in Event settings.
      </p>
      <LogoForm eventId={eventId} logo={logo} color={color} />
    </fieldset>
  );
}
