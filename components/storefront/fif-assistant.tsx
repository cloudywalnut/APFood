"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { GripHorizontal, SendHorizontal, X } from "lucide-react";

type Message = { id: string; role: "assistant" | "user"; text: string };
type Position = { left: number; top: number };

const starterPrompts = ["Fastest pickup now", "Meal deals today", "Quiet stalls"];
const storageKey = "ap-food-fif-position";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function FifAssistant() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [pos, setPos] = useState<Position>();
  const [dragging, setDragging] = useState(false);
  const [viewport, setViewport] = useState({ width: 1200, height: 800 });
  const [launcherSize, setLauncherSize] = useState({ width: 112, height: 44 });
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", text: "Hi! I’m FIF AI. Ask about stalls, meal deals, or pickup times." },
  ]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    const syncViewport = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const rect = launcherRef.current?.getBoundingClientRect();
      const lWidth = rect?.width || 112;
      const lHeight = rect?.height || 44;
      setViewport({ width, height });
      setLauncherSize({ width: lWidth, height: lHeight });
      setPos(previous => previous ? {
        left: clamp(previous.left, 12, width - lWidth - 12),
        top: clamp(previous.top, 12, height - lHeight - 12),
      } : previous);
    };
    syncViewport();
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Position>;
        if (typeof parsed.left === "number" && typeof parsed.top === "number" && Number.isFinite(parsed.left) && Number.isFinite(parsed.top)) {
          const rect = launcherRef.current?.getBoundingClientRect();
          setPos({
            left: clamp(parsed.left, 12, window.innerWidth - (rect?.width || 112) - 12),
            top: clamp(parsed.top, 12, window.innerHeight - (rect?.height || 44) - 12),
          });
        }
      }
    } catch { /* Default corner position remains available. */ }
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  useEffect(() => {
    if (!pos) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify(pos)); } catch { /* Ignore storage errors. */ }
  }, [pos]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  function startDrag(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    if ((event.target as HTMLElement).closest(".fif-window-close")) return;
    const launcher = launcherRef.current;
    if (!launcher) return;
    const rect = launcher.getBoundingClientRect();
    setLauncherSize({ width: rect.width, height: rect.height });
    const startX = event.clientX;
    const startY = event.clientY;
    const originLeft = pos?.left ?? rect.left;
    const originTop = pos?.top ?? rect.top;
    let moved = false;

    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
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

  function send(text: string) {
    const clean = text.trim();
    if (!clean) return;
    setMessages(previous => [
      ...previous,
      { id: crypto.randomUUID(), role: "user", text: clean },
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text: "FIF AI backend is coming soon. Once connected, I’ll answer \"" + clean + "\" using live stall menus and capacity.",
      },
    ]);
    setDraft("");
  }

  const windowWidth = Math.min(360, viewport.width - 24);
  const spaceAbove = pos ? pos.top - 22 : 0;
  const spaceBelow = pos ? viewport.height - (pos.top + launcherSize.height + 22) : 0;
  const openAbove = pos ? spaceAbove >= 260 || spaceAbove >= spaceBelow : true;

  const launcherStyle: CSSProperties | undefined = pos
    ? { left: pos.left, top: pos.top, right: "auto", bottom: "auto" }
    : undefined;

  const windowStyle: CSSProperties | undefined = pos
    ? {
        left: clamp(
          pos.left + launcherSize.width / 2 > viewport.width / 2
            ? pos.left + launcherSize.width - windowWidth
            : pos.left,
          12,
          viewport.width - windowWidth - 12,
        ),
        ...(openAbove
          ? { top: "auto", bottom: viewport.height - pos.top + 10, maxHeight: Math.min(440, Math.max(200, spaceAbove)) }
          : { top: pos.top + launcherSize.height + 10, bottom: "auto", maxHeight: Math.min(440, Math.max(200, spaceBelow)) }),
        right: "auto",
        width: windowWidth,
        transformOrigin: `${pos.left + launcherSize.width / 2 > viewport.width / 2 ? "right" : "left"} ${openAbove ? "bottom" : "top"}`,
      }
    : undefined;

  return <>
    {open && <section className={"fif-window" + (dragging ? " is-dragging" : "")} style={windowStyle} role="dialog" aria-label="FIF AI assistant">
      <header className="fif-window-head" onPointerDown={startDrag}>
        <div className="fif-window-brand">
          <span className="fif-window-badge"><img src="/brand/ap-monogram-v2.png" alt="" width="20" height="20" /></span>
          <div><strong>FIF AI</strong><small>Campus pickup assistant</small></div>
        </div>
        <div className="fif-window-controls">
          <GripHorizontal size={16} className="fif-drag-hint" aria-hidden />
          <button type="button" className="fif-window-close" aria-label="Close FIF AI" onClick={() => setOpen(false)}>
            <X size={18} aria-hidden />
          </button>
        </div>
      </header>
      <div className="fif-window-messages" ref={listRef}>
        {messages.map(message => <div key={message.id} className={"fif-msg fif-msg-" + message.role}>
          <p>{message.text}</p>
        </div>)}
        {messages.length === 1 && <div className="fif-prompts">
          {starterPrompts.map(prompt => <button type="button" key={prompt} onClick={() => send(prompt)}>{prompt}</button>)}
        </div>}
      </div>
      <form className="fif-window-form" onSubmit={event => { event.preventDefault(); send(draft); }}>
        <input ref={inputRef} type="text" placeholder="Ask FIF AI anything…" aria-label="Message FIF AI" value={draft} onChange={event => setDraft(event.target.value)} maxLength={240} />
        <button type="submit" aria-label="Send message" disabled={!draft.trim()}><SendHorizontal size={17} aria-hidden /></button>
      </form>
    </section>}
    <button ref={launcherRef} type="button" className={"fif-launcher" + (dragging ? " is-dragging" : "")} style={launcherStyle} aria-expanded={open} aria-label={open ? "Close FIF AI" : "Open FIF AI"} onPointerDown={startDrag} onClick={() => {
      if (suppressClick.current) { suppressClick.current = false; return; }
      setOpen(value => !value);
    }}>
      <span className="fif-launcher-logo"><img src="/brand/ap-monogram-v2.png" alt="" width="18" height="18" /></span>
      <span>FIF AI</span>
    </button>
  </>;
}
