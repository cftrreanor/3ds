// Company banners (site_banners): the shared vocabulary for the admin page,
// the banner itself and the "who sees it" check.

export const BANNER_TONES = [
  { value: "info", label: "Info", hint: "News and tips" },
  { value: "success", label: "Good news", hint: "Something new or fixed" },
  { value: "warning", label: "Heads up", hint: "Act soon, e.g. a free period ending" },
  { value: "urgent", label: "Urgent", hint: "Outages and must-reads; can't be closed" },
] as const;
export type BannerTone = (typeof BANNER_TONES)[number]["value"];

export const BANNER_AUDIENCES = [
  { value: "hosts", label: "Hosts", where: "their dashboard" },
  { value: "directors", label: "Directors & group leads", where: "their dashboard and band pages" },
  { value: "teams", label: "Event teams (Volunteer Leads, Section Leads)", where: "their dashboard and event pages" },
  { value: "public", label: "Public visitors", where: "the home page" },
] as const;
export type BannerAudience = (typeof BANNER_AUDIENCES)[number]["value"];

export const HOST_FILTERS = [
  { value: "all", label: "All hosts" },
  { value: "pilot", label: "On a pilot" },
  { value: "trial", label: "On a trial" },
  { value: "paid", label: "Paid" },
  { value: "free_ending", label: "Free period ending (30 days) or ended" },
] as const;
export type HostFilter = (typeof HOST_FILTERS)[number]["value"];

export type SiteBanner = {
  id: string;
  title: string;
  body: string | null;
  link_label: string | null;
  link_url: string | null;
  tone: BannerTone;
  audience: BannerAudience;
  host_filter: HostFilter;
  starts_at: string;
  ends_at: string | null;
};

export const BANNER_COLUMNS = "id, title, body, link_label, link_url, tone, audience, host_filter, starts_at, ends_at";

export const audienceLabel = (a: string) => BANNER_AUDIENCES.find((x) => x.value === a)?.label ?? a;
export const hostFilterLabel = (f: string) => HOST_FILTERS.find((x) => x.value === f)?.label ?? f;
