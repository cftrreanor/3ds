// The volunteer tracking spreadsheet: the same columns from the page's table
// (dashboard/volunteer-tracking) and its download route.

export type HistoryRow = {
  email: string;
  full_name: string;
  events: number;
  signed_up: number;
  checked_in: number;
  last_event_name: string;
  last_event_on: string;
};

/** The share of their shifts someone checked in for, 0–100. */
export const showedUp = (r: HistoryRow) => (r.signed_up ? Math.round((r.checked_in / r.signed_up) * 100) : 0);

export function toCsv(rows: HistoryRow[]) {
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const head = ["Name", "Email", "Showed up (%)", "Checked in", "Signed up", "Events", "Last event", "Last event date"];
  const body = rows.map((r) => [r.full_name, r.email, showedUp(r), r.checked_in, r.signed_up, r.events, r.last_event_name, r.last_event_on]);
  return [head, ...body].map((line) => line.map(cell).join(",")).join("\r\n");
}
