/** What every form Server Action returns, for <ActionForm> to display. */
export type ActionState = { ok?: boolean; error?: string; message?: string };

/** Turn a database error into something a booster president can act on. */
export function friendlyDbError(error: { code?: string; message: string }): string {
  switch (error.code) {
    // The code is newer than the database (see lib/schema-check).
    case "42703":
    case "42883":
    case "42P01":
    case "PGRST202":
    case "PGRST204":
    case "PGRST205":
      return "A database update needs to be run before this can be saved. See \u201cApplying database updates\u201d in the setup guide.";
    case "42501":
      return "You don't have permission to do that.";
    case "23505":
      return "That already exists. Try a different name.";
    case "23514":
    case "P0001":
    case "P0002":
    case "P0003":
      // Our own check messages are written for people; pass them through.
      return error.message.includes("violates check constraint")
        ? "Some of the values aren't valid. Please check the form."
        : error.message;
    default:
      console.error("Database error", error);
      return "Something went wrong saving that. Please try again.";
  }
}
