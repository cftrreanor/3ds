// Merge fields for emails written in the admin dashboard: {{first_name}} and
// friends are filled in for each recipient. Shared by the composer (preview)
// and the server (sending).

export const MERGE_FIELDS = [
  { key: "first_name", label: "First name" },
  { key: "name", label: "Full name" },
  { key: "organization", label: "Organization" },
  { key: "plan", label: "Plan" },
  { key: "free_until", label: "Free through" },
  { key: "next_event", label: "Next event" },
  { key: "my_name", label: "Your name" },
] as const;

export type MergeVars = Partial<Record<(typeof MERGE_FIELDS)[number]["key"], string>>;

const FIELD = /\{\{\s*([a-z_]+)\s*\}\}/g;

/** Fill in {{fields}}. Unknown fields stay as typed; known but empty ones are listed in `blank`. */
export function fillTemplate(text: string, vars: MergeVars) {
  const blank = new Set<string>();
  const out = text.replace(FIELD, (whole, key: string) => {
    if (!MERGE_FIELDS.some((f) => f.key === key)) return whole;
    const v = vars[key as keyof MergeVars];
    if (!v) {
      blank.add(key);
      return "";
    }
    return v;
  });
  return { text: out, blank: [...blank] };
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";
