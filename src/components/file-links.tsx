import { fileHref, fileMeta, type EventFile } from "@/lib/event-files";

/** A short list of shared maps and documents; each opens through /files/<id>. */
export function FileLinks({
  files,
  className,
  details,
}: {
  files: EventFile[];
  className?: string;
  /** Extra line per file id, e.g. who uploaded it (for hosts). */
  details?: Map<string, string>;
}) {
  if (files.length === 0) return null;
  return (
    <ul className={`divide-y divide-border rounded-lg border border-border bg-surface ${className ?? ""}`}>
      {files.map((f) => (
        <li key={f.id}>
          <a
            href={fileHref(f.id)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-background"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium text-brand">{f.label}</span>
              <span className="block text-xs text-muted">{fileMeta(f)}</span>
              {details?.get(f.id) && <span className="block text-xs text-muted">{details.get(f.id)}</span>}
            </span>
            <span aria-hidden className="shrink-0 text-sm text-muted">
              Open ↗
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
