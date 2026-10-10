/**
 * Sign-in links in invitation emails (band and team invitations) sign the
 * person straight in, so they only work for a week after the email was sent,
 * and only once. After that, people sign in the normal way.
 */
export const EMAIL_LINK_DAYS = 7;

/** The oldest send time whose link still signs people in. */
export const emailLinkCutoff = () => new Date(Date.now() - EMAIL_LINK_DAYS * 86_400_000).toISOString();
