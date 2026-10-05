import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

// When new code is deployed before its database update has been run, queries
// fail with "column/table/function does not exist". Pages used to turn that
// into a confusing 404; instead they send people to /update-needed.

/** Postgres and PostgREST codes for "the database doesn't have this yet". */
const SCHEMA_CODES = new Set(["42703", "42883", "42P01", "PGRST202", "PGRST204", "PGRST205"]);

export function isSchemaError(error: { code?: string } | null | undefined) {
  return Boolean(error?.code && SCHEMA_CODES.has(error.code));
}

/** Per-request note that a query hit a missing column, table or function. */
const schemaProblem = cache(() => ({ seen: false }));

/** A fetch for the Supabase client that notes schema errors for this request. */
export const schemaAwareFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  if (res.status === 400 || res.status === 404) {
    const body = await res
      .clone()
      .json()
      .catch(() => null);
    if (isSchemaError(body)) {
      console.error("Database is missing something this code expects. Run the newest migration.", body);
      try {
        schemaProblem().seen = true;
      } catch {
        // Outside a request (shouldn't happen): nothing to note.
      }
    }
  }
  return res;
};

/**
 * Use instead of notFound() after loading a page's main data: if the data is
 * missing because the database needs an update, say so instead of "not found".
 */
export function missing(): never {
  if (schemaProblem().seen) redirect("/update-needed");
  notFound();
}
