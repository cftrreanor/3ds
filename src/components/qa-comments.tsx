"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import {
  addComment,
  closedOnGithub,
  loadThread,
  pinsFor,
  replyTo,
  sendToGithub,
  setResolved,
  type Anchor,
  type Pin,
  type Reply,
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

/** Shift+Enter (or Cmd/Ctrl+Enter) sends the box's form; plain Enter is a new line. */
const sendOnShortcut = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if (e.key === "Enter" && (e.shiftKey || e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
    e.preventDefault();
    e.currentTarget.form?.requestSubmit();
  }
};

/** Typing in a field, where a plain key press is text, not a shortcut. */
const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export function QaComments() {
  const pathname = usePathname();
  const router = useRouter();
  const framed = useSyncExternalStore(noChange, () => window.self !== window.top, () => false);
  // ?qaComment=… (from the Comments list or GitHub) opens that comment.
  const linked = useSyncExternalStore(onLocation, () => new URLSearchParams(window.location.search).get("qaComment"), () => null);

  const [pins, setPins] = useState<Pin[]>([]);
  // "pick" is comment mode: it stays on after each comment until Done commenting or Esc.
  const [mode, setMode] = useState<"idle" | "pick" | "compose" | "capture">("idle");
  const [hover, setHover] = useState<DOMRect | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [cardId, setCardId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  // A save that failed in the background, with a way to try it again.
  const [notice, setNotice] = useState<{ message: string; retry?: () => void } | null>(null);
  const [, setTick] = useState(0);
  const shown = openId ?? (linked && linked !== dismissed ? linked : null);

  const refresh = useCallback(() => {
    // Keep any comment still saving in the background.
    pinsFor(pathname).then((saved) => setPins((all) => [...saved, ...all.filter((p) => p.id.startsWith("saving-"))]));
  }, [pathname]);
  useEffect(refresh, [refresh]);

  // Comments fixed and closed on GitHub drop off the page (once per page visit).
  useEffect(() => {
    let live = true;
    closedOnGithub(pathname).then((closed) => {
      if (live && closed.length) setPins((all) => all.map((p) => (closed.includes(p.id) ? { ...p, status: "resolved" } : p)));
    });
    return () => {
      live = false;
    };
  }, [pathname]);

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

  // Esc steps back (a draft to comment mode, comment mode to off); C turns comment mode on and off.
  useEffect(() => {
    if (shown || cardId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mode === "compose") {
        setMode("pick");
        setDraft(null);
        setHover(null);
      } else if (e.key === "Escape" && mode === "pick") {
        setMode("idle");
        setHover(null);
      } else if (e.key.toLowerCase() === "c" && !e.metaKey && !e.ctrlKey && !e.altKey && !typing(e.target) && (mode === "idle" || mode === "pick")) {
        setMode(mode === "idle" ? "pick" : "idle");
        setHover(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, shown, cardId]);

  if (framed) return null;

  const under = (x: number, y: number) => document.elementsFromPoint(x, y).find((el) => !isQaUi(el) && el !== document.documentElement && el !== document.body) ?? null;
  const open = pins.filter((p) => p.status === "open");
  const card = open.find((p) => p.id === cardId);
  const picking = mode === "pick" || mode === "compose";

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
                disabled={p.id.startsWith("saving-")}
                onClick={() => setCardId(cardId === p.id ? null : p.id)}
                aria-label={`Comment ${i + 1} from ${p.author}: ${p.body.slice(0, 60)}`}
                aria-expanded={cardId === p.id}
                style={{ position: "absolute", left: at.x - 14, top: at.y - 14 }}
                className={`${picking || card ? "z-[61]" : "z-30"} flex h-7 w-7 items-center justify-center rounded-full rounded-bl-none bg-danger text-xs font-bold text-danger-foreground shadow-md ring-2 ring-white disabled:opacity-60`}
              >
                {i + 1}
              </button>
            );
          })}

          {(mode === "idle" || mode === "pick") && (
            <button
              type="button"
              onClick={() => {
                setMode(mode === "idle" ? "pick" : "idle");
                setHover(null);
                setCardId(null);
              }}
              aria-pressed={mode === "pick"}
              title="Shortcut: C"
              className={`fixed bottom-4 right-32 min-h-11 rounded-full px-4 text-sm font-semibold shadow-lg hover:opacity-90 ${
                mode === "pick" ? "z-[70] bg-danger text-danger-foreground ring-2 ring-white" : "z-40 bg-header text-white ring-1 ring-white/50"
              }`}
            >
              {mode === "pick" ? "Done commenting" : "Comment"}
            </button>
          )}

          {mode === "pick" && (
            <div
              className="fixed inset-0 z-[60] cursor-crosshair"
              onPointerMove={(e) => setHover(under(e.clientX, e.clientY)?.getBoundingClientRect() ?? null)}
              onPointerLeave={() => setHover(null)}
              onClick={(e) => {
                const el = under(e.clientX, e.clientY);
                if (!el) return;
                setCardId(null);
                setDraft({ anchor: anchorAt(el, e.clientX, e.clientY), x: e.clientX, y: e.clientY });
                setHover(el.getBoundingClientRect());
                setMode("compose");
              }}
            >
              <p className="pointer-events-none fixed left-1/2 top-3 w-max max-w-[calc(100vw-24px)] -translate-x-1/2 rounded-full bg-header px-4 py-2 text-center text-sm font-semibold text-white shadow-lg">
                Comment mode: tap any spot to comment. Esc or Done commenting to stop.
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
                setMode("pick");
                setDraft(null);
                setHover(null);
              }}
              onPost={async (body) => {
                setMode("capture");
                // Let the QA controls disappear before the screenshot.
                await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
                const shot = await screenshot(draft.x, draft.y);
                const input = { body, path: pathname, anchor: draft.anchor, screen: `${window.innerWidth} × ${window.innerHeight}`, screenshot: shot };
                // The pin shows now and the comment saves in the background, so the next spot can start right away.
                const temp: Pin = { id: `saving-${Date.now()}`, author: "You", body, anchor: draft.anchor, status: "open", createdAt: new Date().toISOString() };
                setPins((all) => [...all, temp]);
                setMode("pick");
                setDraft(null);
                setHover(null);
                const save = async () => {
                  const r = await addComment(input).catch(() => ({ error: "We couldn't reach the server." }));
                  if ("error" in r) {
                    setPins((all) => all.filter((p) => p.id !== temp.id));
                    setNotice({
                      message: `Your comment “${body.slice(0, 60)}${body.length > 60 ? "…" : ""}” didn't save. ${r.error}`,
                      retry: () => {
                        setPins((all) => [...all, temp]);
                        save();
                      },
                    });
                  } else {
                    setPins((all) => all.map((p) => (p.id === temp.id ? { ...p, id: r.id } : p)));
                    refresh();
                  }
                };
                save();
                return null;
              }}
            />
          )}

          {card && (
            <PinCard
              key={card.id}
              pin={card}
              number={open.indexOf(card) + 1}
              onClose={() => setCardId(null)}
              onResolve={() => {
                // Gone from the page at once; the save happens behind it.
                setCardId(null);
                setPins((all) => all.filter((p) => p.id !== card.id));
                setResolved(card.id, true)
                  .catch(() => ({ error: "We couldn't reach the server." }))
                  .then((r) => {
                    if ("error" in r) setNotice({ message: `That comment didn't resolve. ${r.error}` });
                    refresh();
                  });
              }}
              onDetails={() => {
                setCardId(null);
                setOpenId(card.id);
              }}
            />
          )}

          {notice && (
            <div role="alert" className="fixed bottom-20 right-4 z-[70] w-[min(360px,calc(100vw-32px))] space-y-3 rounded-lg border border-border bg-background p-3 text-sm shadow-xl">
              <p>{notice.message}</p>
              <div className="flex gap-2">
                {notice.retry && (
                  <Button
                    onClick={() => {
                      const retry = notice.retry;
                      setNotice(null);
                      retry?.();
                    }}
                  >
                    Try again
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setNotice(null)}>
                  Dismiss
                </Button>
              </div>
            </div>
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
          onKeyDown={sendOnShortcut}
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
        <p className="text-xs text-muted">Shift+Enter posts it. A screenshot of your screen is saved with it.</p>
      </form>
    </div>
  );
}

/** A comment with its replies, kept fresh after each reply or resolve. */
function useThread(id: string) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Replies sent from here, kept through a load that started before they saved.
  const mine = useRef<Reply[]>([]);

  // The comment and its replies here first (quick), then again with the ones left on GitHub.
  const load = useCallback(() => {
    let live = true;
    (async () => {
      for (const github of [false, true]) {
        const r = await loadThread(id, github);
        if (!live) return;
        if ("error" in r) return setError(r.error);
        const known = new Set(r.thread.replies.map((x) => x.id));
        const extra = mine.current.filter((x) => !known.has(x.id));
        setThread({ ...r.thread, replies: [...r.thread.replies, ...extra].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) });
      }
    })();
    return () => {
      live = false;
    };
  }, [id]);
  useEffect(load, [load]);

  const act = (fn: () => Promise<{ error: string } | { ok: true }>) =>
    start(async () => {
      const r = await fn();
      if ("error" in r) setError(r.error);
      else {
        setError(null);
        load();
      }
    });

  /** Show the reply at once and save it behind; on failure, take it back and say why. */
  const send = async (text: string): Promise<boolean> => {
    const temp: Reply = { id: `sending-${Date.now()}`, author: "You", body: text, createdAt: new Date().toISOString() };
    setError(null);
    mine.current = [...mine.current, temp];
    setThread((t) => (t ? { ...t, replies: [...t.replies, temp] } : t));
    const r = await replyTo(id, text).catch(() => ({ error: "We couldn't reach the server." }));
    const swap = (list: Reply[]) => list.flatMap((x) => (x.id !== temp.id ? [x] : "error" in r ? [] : [r.reply]));
    mine.current = swap(mine.current);
    setThread((t) => (t ? { ...t, replies: swap(t.replies) } : t));
    if ("error" in r) setError(r.error);
    return !("error" in r);
  };

  return { thread, error, setError, pending, act, send };
}

function Replies({ replies }: { replies: Reply[] }) {
  if (!replies.length) return null;
  return (
    <ul className="space-y-2">
      {replies.map((r) => (
        <li key={r.id} className="rounded-lg border border-border p-3">
          <p className="text-sm">
            <span className="font-semibold">{r.author}</span>{" "}
            <span className="text-muted">{r.id.startsWith("sending-") ? "Sending…" : when(r.createdAt)}</span>
            {r.onGithub && <span className="ml-2 text-muted">on GitHub</span>}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{r.body}</p>
        </li>
      ))}
    </ul>
  );
}

/** The reply box with Reply and Resolve (or Reopen). */
function ReplyForm({
  thread,
  pending,
  act,
  send,
  setError,
  rows,
  autoFocus,
  onResolve,
}: {
  thread: Thread;
  pending: boolean;
  act: ReturnType<typeof useThread>["act"];
  send: ReturnType<typeof useThread>["send"];
  setError: (e: string | null) => void;
  rows: number;
  autoFocus?: boolean;
  /** Resolve here instead (the pin card does it without waiting). */
  onResolve?: () => void;
}) {
  const [reply, setReply] = useState("");
  const resolving = thread.status !== "resolved";
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const text = reply;
        if (!text.trim()) return setError("Type your reply first.");
        setReply("");
        // Didn't save: put the words back so nothing is lost.
        if (!(await send(text))) setReply((now) => now || text);
      }}
    >
      <Textarea
        autoFocus={autoFocus}
        rows={rows}
        maxLength={4000}
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        onKeyDown={sendOnShortcut}
        aria-label="Your reply"
        placeholder="Reply (Shift+Enter to send)"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit">Reply</Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => (resolving && onResolve ? onResolve() : act(() => setResolved(thread.id, resolving)))}
        >
          {resolving ? "Resolve" : "Reopen"}
        </Button>
      </div>
    </form>
  );
}

/** Tap a pin: the comment, its replies, and a reply box, right there on the page. */
function PinCard({
  pin,
  number,
  onClose,
  onResolve,
  onDetails,
}: {
  pin: Pin;
  number: number;
  onClose: () => void;
  onResolve: () => void;
  onDetails: () => void;
}) {
  const { thread, error, setError, pending, act, send } = useThread(pin.id);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const at = placeOf(pin.anchor);
  const page = document.documentElement;
  const width = Math.min(340, page.clientWidth - 24);
  const left = Math.min(Math.max(window.scrollX + 12, at.x - 20), window.scrollX + page.clientWidth - width - 12);

  return (
    <>
      <div className="fixed inset-0 z-[62]" onClick={onClose} />
      <div
        role="dialog"
        aria-label={`Comment ${number}`}
        style={{ position: "absolute", left, top: at.y + 20, width }}
        className="z-[63] space-y-3 rounded-lg border border-border bg-background p-3 shadow-xl"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm">
            <span className="font-semibold">{pin.author}</span> <span className="text-muted">{when(pin.createdAt)}</span>
          </p>
          <button type="button" onClick={onClose} aria-label="Close" className="-m-1 rounded px-2 text-lg leading-none text-muted hover:text-foreground">
            ×
          </button>
        </div>
        <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-sm leading-6">{pin.body}</p>
        {!thread ? (
          error ? <FormMessage error={error} /> : <p className="text-sm text-muted">Loading replies…</p>
        ) : (
          <>
            <div className="max-h-56 overflow-y-auto">
              <Replies replies={thread.replies} />
            </div>
            <ReplyForm thread={thread} pending={pending} act={act} send={send} setError={setError} rows={2} autoFocus onResolve={onResolve} />
            <FormMessage error={error ?? undefined} />
          </>
        )}
        <button type="button" onClick={onDetails} className="text-sm font-medium text-brand underline underline-offset-2">
          Details and screenshot
        </button>
      </div>
    </>
  );
}

function ThreadPanel({ id, pathname, onClose, onGo }: { id: string; pathname: string; onClose: () => void; onGo: (path: string) => void }) {
  const { thread, error, setError, pending, act, send } = useThread(id);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
              </div>

              <section className="space-y-3">
                <h3 className="font-semibold">{thread.replies.length ? "Replies" : "No replies yet"}</h3>
                <Replies replies={thread.replies} />
                <ReplyForm thread={thread} pending={pending} act={act} send={send} setError={setError} rows={2} />
                <FormMessage error={error ?? undefined} />
              </section>

              {/* The technical side, out of the way until it's wanted. */}
              <details className="group rounded-lg border border-border">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 font-semibold [&::-webkit-details-marker]:hidden">
                  Details
                  <span aria-hidden className="text-muted transition-transform group-open:rotate-180">
                    ▾
                  </span>
                </summary>
                <div className="space-y-4 border-t border-border px-4 py-4">
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-muted">
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
                    <Button variant="secondary" onClick={() => onGo(thread.path)}>
                      Go to the page
                    </Button>
                  )}

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
                </div>
              </details>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
