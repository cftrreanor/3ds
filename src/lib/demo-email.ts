/** Demo people's addresses (see src/lib/demo.ts). Nothing is ever sent to them. */
export const DEMO_EMAIL_DOMAIN = "demo.fieldcommandevents.com";

export const isDemoEmail = (email: string | null | undefined) =>
  Boolean(email && email.toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`));
