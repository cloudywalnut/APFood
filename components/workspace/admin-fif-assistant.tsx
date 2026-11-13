"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { GripHorizontal, RotateCcw, SendHorizontal, X } from "lucide-react";
import { createApiClient } from "../../lib/backend/client";
import { useSessionUser } from "./common";
import { RichText } from "../ui/rich-text";
import type { AdminScope } from "../../lib/admin-dashboard";

type Message = { id: string; role: "user" | "assistant"; text: string };
type Position = { left: number; top: number };

const storageKey = "ap-food-admin-fif-position";
const historyKey = (userId: string) => `ap-food-admin-fif-chat:${userId}`;
const maxHistory = 10;

const welcome: Message = {
  id: "welcome",
  role: "assistant",
  text: "Hi! I'm FIF AI. Ask about vendor performance, cashflow, fulfilment, traffic, or any operational question.",
};

const starterPrompts = [
  "Which vendor needs attention today?",
  "Show cashflow summary this week",
  "Any low-stock or fulfilment issues?",
  "Top performing stall this month",
];

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function AdminFifAssistant({ scope }: { scope?: AdminScope }) {
  const user = useSessionUser();
  const api = useMemo(() => (user ? createApiClient(user) : undefined), [user]);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [pos, setPos] = useState<Position>();
  const [dragging, setDragging] = useState(false);
  const [viewport, setViewport] = useState({ width: 1200, height: 800 });
  const [launcherSize, setLauncherSize] = useState({ width: 112, height: 44 });
  const [launcherPosition, setLauncherPosition] = useState<Position>();
  const [restoredFor, setRestoredFor] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const suppressClick = useRef(false);

  // Restore saved chat on sign-in
  useEffect(() => {
    if (!user) {
      setMessages([welcome]);
      setRestoredFor(null);
      return;
    }
    try {
      const raw = sessionStorage.getItem(historyKey(user));
      if (raw) {
        const stored = JSON.parse(raw) as Message[];
        if (Array.isArray(stored) && stored.length > 0) {
          setMessages(stored);
        }
      }
    } catch {
      /* ignore */
    }
    setRestoredFor(user);
  }, [user]);

  // Persist chat
  useEffect(() => {
    if (!user || restoredFor !== user) return;
    try {
      sessionStorage.setItem(historyKey(user), JSON.stringify(messages.slice(-maxHistory * 2)));
    } catch {
      /* ignore */
    }
  }, [messages, user, restoredFor]);

  // Viewport + saved position
  useEffect(() => {
    const sync = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const rect = launcherRef.current?.getBoundingClientRect();
      setViewport({ width: w, height: h });
      setLauncherSize({ width: rect?.width ?? 112, height: rect?.height ?? 44 });
      if (rect) setLauncherPosition({ left: rect.left, top: rect.top });
      setPos((p) =>
        p
          ? {
              left: clamp(p.left, 12, w - (rect?.width ?? 112) - 12),
              top: clamp(p.top, 12, h - (rect?.height ?? 44) - 12),
            }
          : p,
      );
    };
    sync();
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Position>;
        if (typeof parsed.left === "number" && typeof parsed.top === "number") {
          const rect = launcherRef.current?.getBoundingClientRect();
          setPos({
            left: clamp(parsed.left, 12, window.innerWidth - (rect?.width ?? 112) - 12),
            top: clamp(parsed.top, 12, window.innerHeight - (rect?.height ?? 44) - 12),
          });
        }
      }
    } catch {
      /* ignore */
    }
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  useLayoutEffect(() => {
    const rect = launcherRef.current?.getBoundingClientRect();
    if (rect) {
      setLauncherPosition({ left: rect.left, top: rect.top });
      setLauncherSize({ width: rect.width, height: rect.height });
    }
  }, [pos, open]);

  useEffect(() => {
    if (!pos) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(pos));
    } catch {
      /* ignore */
    }
  }, [pos]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open, pending]);

  function startDrag(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    if ((event.target as HTMLElement).closest(".admin-fif-close")) return;
    const launcher = launcherRef.current;
    if (!launcher) return;
    const rect = launcher.getBoundingClientRect();
    setLauncherSize({ width: rect.width, height: rect.height });
    const startX = event.clientX;
    const startY = event.clientY;
    const originLeft = pos?.left ?? rect.left;
    const originTop = pos?.top ?? rect.top;
    let moved = false;
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < 6) return;
      if (!moved) {
        moved = true;
        setDragging(true);
      }
      setPos({
        left: clamp(originLeft + dx, 12, window.innerWidth - rect.width - 12),
        top: clamp(originTop + dy, 12, window.innerHeight - rect.height - 12),
      });
    };
    const stop = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      setDragging(false);
      if (moved) suppressClick.current = true;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || pending || !api) return;
    const question: Message = { id: crypto.randomUUID(), role: "user", text: clean };
    setMessages((prev) => [...prev, question]);
    setDraft("");
    setPending(true);
    try {
      const history = messages
        .filter((m) => m.id !== "welcome")
        .slice(-maxHistory * 2)
        .map(({ role, text: t }) => ({ role, text: t.slice(0, 2000) }));
      const result = await api.adminChat({
        scope: scope ?? { days: "7" },
        message: clean,
        history,
      });
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", text: result.reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: err instanceof Error ? err.message : "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  const anchor = pos ?? launcherPosition;
  const windowWidth = Math.min(420, viewport.width - 24);
  const spaceAbove = anchor ? Math.max(0, anchor.top - 22) : 0;
  const spaceBelow = anchor ? Math.max(0, viewport.height - (anchor.top + launcherSize.height + 22)) : 0;
  const openAbove = spaceAbove >= 280 || spaceAbove >= spaceBelow;
  const windowHeight = Math.min(viewport.width <= 700 ? 600 : 580, openAbove ? spaceAbove : spaceBelow);

  const launcherStyle: CSSProperties | undefined = pos
    ? { left: pos.left, top: pos.top, right: "auto", bottom: "auto" }
    : undefined;

  const windowStyle: CSSProperties | undefined = anchor
    ? {
        left: clamp(
          anchor.left + launcherSize.width / 2 > viewport.width / 2
            ? anchor.left + launcherSize.width - windowWidth
            : anchor.left,
          12,
          viewport.width - windowWidth - 12,
        ),
        top: openAbove ? anchor.top - 10 - windowHeight : anchor.top + launcherSize.height + 10,
        bottom: "auto",
        right: "auto",
        width: windowWidth,
        height: windowHeight,
        transformOrigin: `${anchor.left + launcherSize.width / 2 > viewport.width / 2 ? "right" : "left"} ${openAbove ? "bottom" : "top"}`,
      }
    : undefined;

  return (
    <>
      {open && (
        <section
          className={"admin-fif-window" + (dragging ? " is-dragging" : "")}
          style={windowStyle}
          role="dialog"
          aria-label="FIF AI admin assistant"
        >
          <header className="admin-fif-head" onPointerDown={startDrag}>
            <div className="admin-fif-brand">
              <span className="admin-fif-badge">
                <img src="/brand/ap-monogram-v2.png" alt="" width="20" height="20" />
              </span>
              <div>
                <strong>FIF AI</strong>
                <small>Admin assistant</small>
              </div>
            </div>
            <div className="admin-fif-controls">
              <GripHorizontal size={16} className="admin-fif-drag-hint" aria-hidden />
              <button
                type="button"
                className="admin-fif-close"
                aria-label="New conversation"
                title="New conversation"
                disabled={pending}
                onClick={() => {
                  setMessages([welcome]);
                  setDraft("");
                  inputRef.current?.focus();
                }}
              >
                <RotateCcw size={16} aria-hidden />
              </button>
              <button
                type="button"
                className="admin-fif-close"
                aria-label="Close FIF AI"
                onClick={() => setOpen(false)}
              >
                <X size={18} aria-hidden />
              </button>
            </div>
          </header>

          <div className="admin-fif-messages" ref={listRef} aria-live="polite">
            {messages.map((msg) => (
              <div key={msg.id} className={"admin-fif-msg admin-fif-msg-" + msg.role}>
                <div className="admin-fif-msg-bubble">
                  {msg.role === "assistant" ? <RichText text={msg.text} /> : msg.text}
                </div>
              </div>
            ))}
            {pending && (
              <div className="admin-fif-msg admin-fif-msg-assistant" role="status">
                <div className="admin-fif-msg-bubble">
                  <p>Checking data…</p>
                </div>
              </div>
            )}
            {messages.length === 1 && (
              <div className="admin-fif-prompts">
                {starterPrompts.map((p) => (
                  <button type="button" key={p} onClick={() => void send(p)}>
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            className="admin-fif-form"
            onSubmit={(e) => {
              e.preventDefault();
              void send(draft);
            }}
          >
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask about vendors, cashflow, traffic…"
              aria-label="Message FIF AI"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={400}
            />
            <button type="submit" aria-label="Send message" disabled={!draft.trim() || pending}>
              <SendHorizontal size={17} aria-hidden />
            </button>
          </form>
        </section>
      )}

      <button
        ref={launcherRef}
        type="button"
        className={"admin-fif-launcher" + (dragging ? " is-dragging" : "")}
        style={launcherStyle}
        aria-expanded={open}
        aria-label={open ? "Close FIF AI" : "Open FIF AI"}
        onPointerDown={startDrag}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          setOpen((v) => !v);
        }}
      >
        <span className="admin-fif-launcher-logo">
          <img src="/brand/ap-monogram-v2.png" alt="" width="18" height="18" />
        </span>
        <span>FIF AI</span>
      </button>
    </>
  );
}
