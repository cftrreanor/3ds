import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry-options";

// Error alerts on the server (lib/sentry-options.ts). Logged errors count too,
// so a failed email or privacy deletion in the daily job raises an alert.
export function register() {
  Sentry.init({
    ...sentryOptions,
    integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],
  });
}

// Errors thrown while rendering a page or running a server action.
export const onRequestError = Sentry.captureRequestError;
