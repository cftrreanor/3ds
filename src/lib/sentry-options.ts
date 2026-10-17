import type { BrowserOptions, ErrorEvent } from "@sentry/nextjs";

// Error alerts (sentry.io). Off until NEXT_PUBLIC_SENTRY_DSN is set (docs/SETUP-GUIDE.md).
// Families' and volunteers' details never leave the app: no user info, cookies,
// headers, or form contents are sent, email addresses and phone numbers are
// blanked everywhere, and the private part of manage links, passes, and invites
// is blanked in addresses.

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// US phone numbers as the app stores them (+15125550103) or as people type them
// ((512) 555-0103, 512-555-0103, 512.555.0103). Plain runs of digits are left
// alone, so times and counts in a report stay readable.
const PHONE = /\+1\d{10}\b|(?<!\d)\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}(?!\d)/g;
// A long random string after a slash or "=" in an address: the key to someone's booking or pass.
const TOKEN = /(?<=[/=])[A-Za-z0-9_-]{20,}/g;

const cleanUrl = (url: unknown) => (typeof url === "string" ? url.replace(TOKEN, "[token]") : url);

/** Strips personal details from an error report before it's sent. */
export function scrubEvent(event: ErrorEvent): ErrorEvent | null {
  delete event.user;
  if (event.request) {
    event.request = { url: cleanUrl(event.request.url) as string | undefined, method: event.request.method };
  }
  for (const crumb of event.breadcrumbs ?? []) {
    if (crumb.data) {
      for (const key of ["url", "to", "from"]) crumb.data[key] = cleanUrl(crumb.data[key]);
      delete crumb.data.arguments;
    }
  }
  // Emails and phone numbers can turn up anywhere: database messages, email
  // service replies, logged values. Only text is changed, never numbers.
  return JSON.parse(JSON.stringify(event, (_key, value) => (typeof value === "string" ? value.replace(EMAIL, "[email]").replace(PHONE, "[phone]") : value)));
}

export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  // Collect nothing about people or what they typed: no user info, cookies,
  // headers, request or response bodies, query strings, database values, or
  // the values of variables when the error happened.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    databaseQueryData: false,
    queues: false,
    stackFrameVariables: false,
    graphQL: { document: false, variables: false },
    genAI: { inputs: false, outputs: false },
  },
  // Errors only: no performance tracing or session recordings.
  tracesSampleRate: 0,
  beforeSend: scrubEvent,
} satisfies BrowserOptions;
