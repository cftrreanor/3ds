import { GRADES } from "./grades";

// Totals for a school visitor event's Parent registration card. Only counts:
// no child's name leaves the door check-in list.

type Row = { created_at: string; checked_in_at: string | null; adult_count: number | null; other_adults: unknown; children: unknown };
type Kid = { name?: string; teacher?: string; grade?: string };

export type ParentStats = ReturnType<typeof parentStats>;

export function parentStats(rows: Row[], now = new Date()) {
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const kids = (r: Row) => (Array.isArray(r.children) ? (r.children as Kid[]) : []);
  const others = (r: Row) => (Array.isArray(r.other_adults) ? (r.other_adults as { checked_in_at?: string | null }[]) : []);
  const adults = (r: Row) => Math.max(r.adult_count ?? 1, 1 + others(r).length);
  // Each adult checks in on their own; a family has arrived once any of them has.
  const adultsIn = (r: Row) => (r.checked_in_at ? 1 : 0) + others(r).filter((a) => a?.checked_in_at).length;
  const arrived = rows.filter((r) => adultsIn(r) > 0);

  // Children per grade (in school order), and how many of them have a parent checked in.
  const grades = new Map<string, { children: number; arrived: number }>();
  for (const r of rows) {
    for (const k of kids(r)) {
      const g = grades.get(k.grade ?? "") ?? { children: 0, arrived: 0 };
      g.children++;
      if (adultsIn(r) > 0) g.arrived++;
      grades.set(k.grade ?? "", g);
    }
  }
  const order = (g: string) => {
    const i = (GRADES as readonly string[]).indexOf(g);
    return i === -1 ? GRADES.length : i;
  };

  // Children per teacher. Parents type the name, so "smith" and "Smith " count together.
  const teachers = new Map<string, { name: string; children: number }>();
  for (const r of rows) {
    for (const k of kids(r)) {
      let name = (k.teacher ?? "").trim().replace(/\s+/g, " ");
      // "patel" → "Patel" (names typed with capitals are left as typed).
      if (name === name.toLowerCase()) name = name.replace(/(^|[\s'-])\p{L}/gu, (m) => m.toUpperCase());
      if (!name) continue;
      const key = name.toLowerCase();
      const t = teachers.get(key) ?? { name, children: 0 };
      t.children++;
      teachers.set(key, t);
    }
  }

  return {
    families: rows.length,
    adults: rows.reduce((n, r) => n + adults(r), 0),
    children: rows.reduce((n, r) => n + kids(r).length, 0),
    newThisWeek: rows.filter((r) => r.created_at >= weekAgo).length,
    familiesArrived: arrived.length,
    adultsArrived: rows.reduce((n, r) => n + adultsIn(r), 0),
    byGrade: [...grades.entries()]
      .sort(([a], [b]) => order(a) - order(b) || a.localeCompare(b))
      .map(([grade, g]) => ({ grade, ...g })),
    byTeacher: [...teachers.values()].sort((a, b) => b.children - a.children || a.name.localeCompare(b.name)),
  };
}
