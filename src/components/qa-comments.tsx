"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import {
  addComment,
  loadThread,
  pinsFor,
  replyTo,
  sendToGithub,
  setResolved,
  type Anchor,
  type Pin,
  type Thread,
} from "@/app/qa/comment-actions";
import { Button, FormMessage, Textarea } from "@/components/ui";

// Comments on QA pages (src/app/qa/comment-actions.ts): pick a spot, write,
// and it's saved with a screenshot; numbered pins show each open comment.

const noChange = () => () => {};
const onLocation = (cb: () => void) => {
  window.addEventListener("popstate", cb);
  return () => window.removeEventListener("popstate", cb);
};

/** Our own QA controls: never picked. */
const isQaUi = (el: Element | null) => Boolean(el?.closest("[data-qa-ui]"));
/** The floating ones (buttons, pins, panels) are also left out of screenshots; the QA bar stays, so nothing shifts. */
const isFloating = (el: Element) => Boolean(el.closest("[data-qa-float]"));

/** A path to the element, tag by tag ("main > form:nth-of-type(1) > button:nth-of-type(2)"). */
function cssPath(el: Element): string {
  const parts: string[] = [];
  for (let node: Element | null = el; node && node !== document.body && parts.length < 14; node = node.parentElement) {
    // Stable ids only (React's generated ones change between visits).
    if (node.id && /^[A-Za-z][\w-]*$/.test(node.id)) {
      parts.unshift(`#${node.id}`);
      break;
    }
    const tag = node.tagName.toLowerCase();
    const same = node.parentElement ? [...node.parentElement.children].filter((c) => c.tagName === node!.tagName) : [];
    parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(node) + 1})` : tag);
  }
  return parts.join(" > ");
}

function anchorAt(el: Element, x: number, y: number): Anchor {
  const r = el.getBoundingClientRect();
  const text = ((el as HTMLElement).innerText || el.getAttribute("aria-label") || el.getAttribute("alt") || "").trim().replace(/\s+/g, " ");
  return {
    selector: cssPath(el),
    fx: r.width ? (x - r.left) / r.width : 0,
    fy: r.height ? (y - r.top) / r.height : 0,
    px: (x + window.scrollX) / document.documentElement.scrollWidth,
    py: y + window.scrollY,
    text: text.slice(0, 80) || undefined,
  };
}

/** Where a pin goes on the page now: on its element if it's still there, else where it was. */
function placeOf(a: Anchor): { x: number; y: number } {
  try {
    const el = a.selector ? document.querySelector(a.selector) : null;
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width || r.height) return { x: r.left + window.scrollX + (a.fx ?? 0) * r.width, y: r.top + window.scrollY + (a.fy ?? 0) * r.height };
    }
  } catch {
    // A selector the browser won't take: fall back below.
  }
  return { x: (a.px ?? 0) * document.documentElement.scrollWidth, y: a.py ?? 0 };
}

/** What's on screen, as a JPEG, with the spot circled. Null if the browser can't. */
async function screenshot(x: number, y: number): Promise<string | null> {
  try {
    const { domToCanvas } = await import("modern-screenshot");
    const w = window.innerWidth;
    const h = window.innerHeight;
    const canvas = await domToCanvas(document.body, {
      width: w,
      height: h,
      scale: w > 1280 ? 1280 / w : 1,
      backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
      style: { transform: `translate(${-window.scrollX}px, ${-window.scrollY}px)` },
      filter: (node) => !(node instanceof Element && isFloating(node)),
    });
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const s = canvas.width / w;
      ctx.strokeStyle = "#dc2626";
      ctx.lineWidth = 4 * s;
      ctx.beginPath();
      ctx.arc(x * s, y * s, 22 * s, 0, Math.PI * 2);
      ctx.stroke();
    }
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch (err) {
    console.error("QA screenshot failed", err);
    return null;
  }
}

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

type Draft = { anchor: Anchor; x: number; y: number };

export function QaComments() {
  const pathname = usePathname();
  const router = useRouter();
  const framed = useSyncExternalStore(noChange, () => window.self !== window.top, () => false);
  // ?qaComment=… (from the Comments list or GitHub) opens that comment.
  const linked = useSyncExternalStore(onLocation, () => new URLSearchParams(window.location.search).get("qaComment"), () => null);

  const [pins, setPins] = useState<Pin[]>([]);
  const [mode, setMode] = useState<"idle" | "pick" | "compose" | "capture">("idle");
  const [hover, setHover] = useState<DOMRect | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const shown = openId ?? (linked && linked !== dismissed ? linked : null);

  const refresh = useCallback(() => {
    pinsFor(pathname).then(setPins);
  }, [pathname]);
  useEffect(refresh, [refresh]);

  // Pins follow their elements as the page lays out.
  useEffect(() => {
    const again = () => setTick((t) => t + 1);
    const ro = new ResizeObserver(again);
    ro.observe(document.body);
    window.addEventListener("resize", again);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", again);
    };
  }, []);

  useEffect(() => {
    if (mode !== "pick" && mode !== "compose") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMode("idle");
        setDraft(null);
        setHover(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode]);

  if (framed) return null;

  const under = (x: number, y: number) => document.elementsFromPoint(x, y).find((el) => !isQaUi(el) && el !== document.documentElement && el !== document.body) ?? null;
  const open = pins.filter((p) => p.status === "open");

  return (
    <>
      {mode !== "capture" && (
        <div data-qa-ui data-qa-float className="print:hidden">
          {open.map((p, i) => {
            const at = placeOf(p.anchor);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setOpenId(p.id)}
                aria-label={`Comment ${i + 1} from ${p.author}: ${p.body.slice(0, 60)}`}
                style={{ position: "absolute", left: at.x - 14, top: at.y - 14 }}
                className="z-30 flex h-7 w-7 items-center justify-center rounded-full rounded-bl-none bg-danger text-xs font-bold text-danger-foreground shadow-md ring-2 ring-white"
              >
                {i + 1}
              </button>
            );
          })}

          {mode === "idle" && (
            <button
              type="button"
              onClick={() => setMode("pick")}
              className="fixed bottom-4 right-32 z-40 min-h-11 rounded-full bg-header px-4 text-sm font-semibold text-white shadow-lg ring-1 ring-white/50 hover:opacity-90"
            >
              Comment
            </button>
          )}

          {mode === "pick" && (
            <div
              className="fixed inset-0 z-[60] cursor-crosshair"
              onPointerMove={(e) => setHover(under(e.clientX, e.clientY)?.getBoundingClientRect() ?? null)}
              onClick={(e) => {
                const el = under(e.clientX, e.clientY);
                if (!el) return;
                setDraft({ anchor: anchorAt(el, e.clientX, e.clientY), x: e.clientX, y: e.clientY });
                setHover(el.getBoundingClientRect());
                setMode("compose");
              }}
            >
              <p className="pointer-events-none fixed left-1/2 top-3 -translate-x-1/2 rounded-full bg-header px-4 py-2 text-sm font-semibold text-white shadow-lg">
                Tap the spot you want to comment on. Esc to cancel.
              </p>
              {hover && (
                <div
                  className="pointer-events-none fixed rounded-sm outline outline-2 outline-offset-2 outline-danger"
                  style={{ left: hover.left, top: hover.top, width: hover.width, height: hover.height }}
                />
              )}
            </div>
          )}

          {mode === "compose" && draft && (
            <Composer
              draft={draft}
              highlight={hover}
              onCancel={() => {
                setMode("idle");
                setDraft(null);
                setHover(null);
              }}
              onPost={async (body) => {
                setMode("capture");
                // Let the QA controls disappear before the screenshot.
                await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
                const shot = await screenshot(draft.x, draft.y);
                const r = await addComment({
                  body,
                  path: pathname,
                  anchor: draft.anchor,
                  screen: `${window.innerWidth} × ${window.innerHeight}`,
                  screenshot: shot,
                });
                if ("error" in r) {
                  setMode("compose");
                  return r.error;
                }
                setMode("idle");
                setDraft(null);
                setHover(null);
                refresh();
                setOpenId(r.id);
                return null;
              }}
            />
          )}

          {shown && (
            <ThreadPanel
              id={shown}
              pathname={pathname}
              onClose={() => {
                setOpenId(null);
                setDismissed(linked);
                refresh();
              }}
              onGo={(path) => router.push(`${path}${path.includes("?") ? "&" : "?"}qaComment=${shown}`)}
            />
          )}
        </div>
      )}
    </>
  );
}

function Composer({
  draft,
  highlight,
  onCancel,
  onPost,
}: {
  draft: Draft;
  highlight: DOMRect | null;
  onCancel: () => void;
  onPost: (body: string) => Promise<string | null>;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const width = Math.min(340, window.innerWidth - 24);
  const left = Math.min(Math.max(12, draft.x - width / 2), window.innerWidth - width - 12);
  const below = draft.y + 24 + 220 < window.innerHeight;
  const top = below ? draft.y + 24 : Math.max(12, draft.y - 24 - 220);
  return (
    <div className="fixed inset-0 z-[60]" onClick={onCancel}>
      {highlight && (
        <div
          className="pointer-events-none fixed rounded-sm outline outline-2 outline-offset-2 outline-danger"
          style={{ left: highlight.left, top: highlight.top, width: highlight.width, height: highlight.height }}
        />
      )}
      <form
        role="dialog"
        aria-label="New comment"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!body.trim()) return setError("Type your comment first.");
          setError(null);
          start(async () => setError(await onPost(body)));
        }}
        style={{ left, top, width }}
        className="fixed space-y-3 rounded-lg border border-border bg-background p-3 shadow-xl"
      >
        {draft.anchor.text && <p className="line-clamp-1 text-xs text-muted">Near “{draft.anchor.text}”</p>}
        <Textarea
          autoFocus
          rows={3}
          maxLength={4000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-label="Your comment"
          placeholder="What should change here?"
        />
        <FormMessage error={error ?? undefined} />
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Post comment"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
        <p className="text-xs text-muted">A screenshot of your screen is saved with it.</p>
      </form>
    </div>
  );
}

function ThreadPanel({ id, pathname, onClose, onGo }: { id: string; pathname: string; onClose: () => void; onGo: (path: string) => void }) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [pending, start] = useTransition();
  const panel = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    loadThread(id).then((r) => {
      if ("error" in r) setError(r.error);
      else setThread(r.thread);
    });
  }, [id]);
  useEffect(load, [load]);
  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const act = (fn: () => Promise<{ error: string } | { ok: true }>) =>
    start(async () => {
      const r = await fn();
      if ("error" in r) setError(r.error);
      else {
        setError(null);
        load();
      }
    });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="qa-thread-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-background shadow-xl outline-none"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-background px-5 py-3">
          <h2 id="qa-thread-title" className="text-lg font-semibold">
            Comment
          </h2>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="space-y-5 px-5 py-5">
          {!thread ? (
            error ? <FormMessage error={error} /> : <p className="text-muted">Loading…</p>
          ) : (
            <>
              <div>
                <p className="text-sm">
                  <span className="font-semibold">{thread.author}</span> <span className="text-muted">{when(thread.createdAt)}</span>
                  {thread.status === "resolved" && <span className="ml-2 font-semibold text-success">Resolved{thread.resolvedBy ? ` by ${thread.resolvedBy}` : ""}</span>}
                </p>
                <p className="mt-2 whitespace-pre-wrap leading-7">{thread.body}</p>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-muted">
                  <dt className="font-semibold">Page</dt>
                  <dd className="break-all">{thread.path}</dd>
                  {thread.viewingAs && (
                    <>
                      <dt className="font-semibold">Viewing as</dt>
                      <dd>{thread.viewingAs}</dd>
                    </>
                  )}
                  {thread.screen && (
                    <>
                      <dt className="font-semibold">Screen</dt>
                      <dd>{thread.screen}</dd>
                    </>
                  )}
                  {thread.anchor.text && (
                    <>
                      <dt className="font-semibold">Near</dt>
                      <dd>“{thread.anchor.text}”</dd>
                    </>
                  )}
                </dl>
                {thread.path.split("?")[0] !== pathname && (
                  <Button variant="secondary" className="mt-3" onClick={() => onGo(thread.path)}>
                    Go to the page
                  </Button>
                )}
              </div>

              {thread.hasScreenshot && (
                <a href={`/qa/comments/${thread.id}/screenshot`} target="_blank" rel="noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a private, signed-in image */}
                  <img src={`/qa/comments/${thread.id}/screenshot`} alt="What the screen looked like, with the spot circled" className="w-full rounded-lg border border-border" />
                  <span className="mt-1 block text-sm text-brand underline underline-offset-2">Open the screenshot</span>
                </a>
              )}

              <div className="flex flex-wrap items-center gap-3 text-sm">
                {thread.issue ? (
                  <a href={thread.issue.url} target="_blank" rel="noreferrer" className="font-medium text-brand underline underline-offset-2">
                    GitHub issue #{thread.issue.number}
                  </a>
                ) : thread.githubReady ? (
                  <Button variant="secondary" disabled={pending} onClick={() => act(() => sendToGithub(thread.id))}>
                    Send to GitHub
                  </Button>
                ) : (
                  <span className="text-muted">Not on GitHub yet (it isn&apos;t connected).</span>
                )}
              </div>

              <section>
                <h3 className="font-semibold">{thread.replies.length ? "Replies" : "No replies yet"}</h3>
                <ul className="mt-2 space-y-3">
                  {thread.replies.map((r) => (
                    <li key={r.id} className="rounded-lg border border-border p-3">
                      <p className="text-sm">
                        <span className="font-semibold">{r.author}</span> <span className="text-muted">{when(r.createdAt)}</span>
                        {r.onGithub && <span className="ml-2 text-muted">on GitHub</span>}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{r.body}</p>
                    </li>
                  ))}
                </ul>
                <form
                  className="mt-3 space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!reply.trim()) return setError("Type your reply first.");
                    act(async () => {
                      const r = await replyTo(thread.id, reply);
                      if ("ok" in r) setReply("");
                      return r;
                    });
                  }}
                >
                  <Textarea rows={2} maxLength={4000} value={reply} onChange={(e) => setReply(e.target.value)} aria-label="Your reply" placeholder="Reply" />
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={pending}>
                      Reply
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => act(() => setResolved(thread.id, thread.status !== "resolved"))}
                    >
                      {thread.status === "resolved" ? "Reopen" : "Resolve"}
                    </Button>
                  </div>
                </form>
                <FormMessage error={error ?? undefined} />
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
