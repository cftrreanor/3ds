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
  { key: "login_url", label: "Sign-in link" },
  { key: "dashboard_url", label: "Dashboard link" },
  { key: "site_url", label: "Website link" },
] as const;

/** Ready-made buttons for the link fields (the toolbar's "Quick button" menu). */
export const QUICK_BUTTONS = [
  { label: "Sign-in button", markup: "[[Sign in|{{login_url}}]]" },
  { label: "Dashboard button", markup: "[[Open my dashboard|{{dashboard_url}}]]" },
  { label: "Website button", markup: "[[Visit our website|{{site_url}}]]" },
] as const;

/**
 * The link fields for one person on this site: a sign-in link with their
 * email filled in (it lands on their dashboard), the dashboard, the home page.
 */
export function siteLinks(origin: string, email?: string): MergeVars {
  const login = new URLSearchParams({ next: "/dashboard", ...(email ? { email } : {}) });
  return { login_url: `${origin}/login?${login}`, dashboard_url: `${origin}/dashboard`, site_url: origin };
}

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
