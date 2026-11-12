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
import Link from "next/link";
import { ArrowRight, GripHorizontal, RotateCcw, SendHorizontal, X } from "lucide-react";
import { createApiClient } from "../../lib/backend/client";
import { broadcastCart } from "../../lib/backend/cart";
import { confirmFifCart } from "../../lib/confirm-fif-cart";
import { useSessionUser } from "../workspace/common";
import { RichText } from "../ui/rich-text";
import {
  chatStorageKey,
  clearStudentFifChats,
  maxStoredMessages,
  readStoredChat,
  type StudentFifMessage as Message,
} from "../../lib/student-fif-chat-storage";

type Position = { left: number; top: number };

const starterPrompts = ["Where is my order?", "Fastest pickup now", "Meal deals today", "What did I order last week?"];
const storageKey = "ap-food-student-fif-position";
// Earlier back-and-forth sent with each question, so answers stay on topic without long prompts.
const historyExchanges = 5;
const welcome: Message = {
  id: "welcome",
  role: "assistant",
  text: "Hi! I’m FIF AI. Ask about your orders, pickups, order history, menus, deals or pickup times.",
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function StudentFifAssistant() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [pos, setPos] = useState<Position>();
  const [dragging, setDragging] = useState(false);
  const [viewport, setViewport] = useState({ width: 1200, height: 800 });
  const [launcherSize, setLauncherSize] = useState({ width: 112, height: 44 });
  const [launcherPosition, setLauncherPosition] = useState<Position>();
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [pending, setPending] = useState(false);
  const user = useSessionUser();
  const activeUser = useRef(user);
  activeUser.current = user;
  const addingCart = useRef(false);
  const api = useMemo(() => (user ? createApiClient(user) : undefined), [user]);
  // Becomes the user ID once that student's saved chat has been loaded, so the empty
  // starting state never overwrites what is stored.
  const [restoredFor, setRestoredFor] = useState<string | null>(null);

  useEffect(() => {
    clearStudentFifChats(user ?? undefined);
    if (!user) {
      setMessages([welcome]);
      setRestoredFor(null);
      return;
    }
    const stored = readStoredChat(user);
    // A question asked just before the page changed never got its answer.
    if (stored?.[stored.length - 1]?.role === "user") {
      const interrupted = stored.at(-1)!;
      const suggestion = stored.filter((message) => message.role === "assistant").at(-1);
      const recoverCart =
        /^(?:yes(?: please)?|confirm|go ahead|add it)[!.\s]*$/i.test(interrupted.text) &&
        suggestion?.cartAction &&
        suggestion.actionState !== "added";
      stored.push({
        id: crypto.randomUUID(),
        role: "assistant",
        text: recoverCart
          ? "That cart confirmation was interrupted. Confirm again to check whether it saved; it won't add twice."
          : "That answer was interrupted when the page changed. Please ask again.",
        ...(recoverCart ? { cartAction: suggestion.cartAction } : {}),
      });
    }
    setMessages(stored ?? [welcome]);
    setRestoredFor(user);
  }, [user]);

  useEffect(() => {
    if (!user || restoredFor !== user) return;
    try {
      sessionStorage.setItem(chatStorageKey(user), JSON.stringify(messages.slice(-maxStoredMessages)));
    } catch {
      /* Storage can be full or blocked; the chat still works for this page. */
    }
  }, [messages, user, restoredFor]);
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
      if (rect) setLauncherPosition({ left: rect.left, top: rect.top });
      setPos((previous) =>
        previous
          ? {
              left: clamp(previous.left, 12, width - lWidth - 12),
              top: clamp(previous.top, 12, height - lHeight - 12),
            }
          : previous,
      );
    };
    syncViewport();
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Position>;
        if (
          typeof parsed.left === "number" &&
          typeof parsed.top === "number" &&
          Number.isFinite(parsed.left) &&
          Number.isFinite(parsed.top)
        ) {
          const rect = launcherRef.current?.getBoundingClientRect();
          setPos({
            left: clamp(parsed.left, 12, window.innerWidth - (rect?.width || 112) - 12),
            top: clamp(parsed.top, 12, window.innerHeight - (rect?.height || 44) - 12),
          });
        }
      }
    } catch {
      /* Default corner position remains available. */
    }
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  // Measure the CSS corner position as well as a restored/dragged position. The
  // panel must use the actual launcher bounds, rather than a separate CSS offset.
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
      /* Ignore storage errors. */
    }
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
  }, [messages, open, pending]);

  function startDrag(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    if ((event.target as HTMLElement).closest(".student-fif-window-close")) return;
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

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || pending) return;
    const question: Message = { id: crypto.randomUUID(), role: "user", text: clean };
    const reply = (answer: string, links?: Message["links"], cartAction?: Message["cartAction"]) =>
      setMessages((previous) => [
        ...previous,
        { id: crypto.randomUUID(), role: "assistant", text: answer, links, cartAction },
      ]);
    setMessages((previous) => [...previous, question]);
    setDraft("");
    if (!api) {
      reply("Please log in so I can look up your orders, pickups and history.");
      return;
    }
    setPending(true);
    try {
      const lastAssistant = messages.filter((message) => message.role === "assistant").at(-1);
      if (/^(?:yes(?: please)?|confirm|go ahead|add it)[!.\s]*$/i.test(clean)) {
        if (lastAssistant?.cartAction && lastAssistant.actionState !== "added") await addPreparedCart(lastAssistant);
        else reply("Please tell me which menu item and quantity to add. I need a cart suggestion to confirm first.");
        return;
      }
      const earlier = messages.filter((message) => message.id !== "welcome").slice(-historyExchanges * 2);
      // Never start the history with an answer whose question was cut off.
      if (earlier[0]?.role === "assistant") earlier.shift();
      const history = [...earlier, question].map(({ role, text }) => ({ role, text: text.slice(0, 2000) }));
      const result = await api.studentFifChat(history);
      if (activeUser.current !== user) return;
      reply(result.reply, result.links, result.cartAction);
    } catch (error) {
      if (activeUser.current !== user) return;
      reply(error instanceof Error ? error.message : "Sorry, something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function addPreparedCart(message: Message) {
    if (!api || !user || !message.cartAction || addingCart.current) return;
    addingCart.current = true;
    setPending(true);
    try {
      const savedAttempt = sessionStorage.getItem("ap-food-checkout:" + user);
      if (savedAttempt && JSON.parse(savedAttempt).pending)
        throw new Error("Resolve your pending checkout before changing the cart.");
      await confirmFifCart(api, user, message.cartAction);
      if (activeUser.current !== user) return;
      setMessages((previous) => [
        ...previous.map((entry) => (entry.id === message.id ? { ...entry, actionState: "added" as const } : entry)),
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: `Added ${message.cartAction!.description} to your cart.`,
          links: [{ href: "/app/cart", label: "View cart" }],
        },
      ]);
      broadcastCart();
    } catch (error) {
      if (activeUser.current !== user) return;
      setMessages((previous) => [
        ...previous.map((entry) => (entry.id === message.id ? { ...entry, actionState: "failed" as const } : entry)),
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: error instanceof Error ? error.message : "The cart addition could not be confirmed. Please try again.",
        },
      ]);
    } finally {
      addingCart.current = false;
      setPending(false);
    }
  }

  // The open window keeps one comfortable size; it only shrinks when the screen is too small.
  const anchor = pos ?? launcherPosition;
  const windowWidth = Math.min(420, viewport.width - 24);
  const spaceAbove = anchor ? Math.max(0, anchor.top - 22) : 0;
  const spaceBelow = anchor ? Math.max(0, viewport.height - (anchor.top + launcherSize.height + 22)) : 0;
  const openAbove = spaceAbove >= 280 || spaceAbove >= spaceBelow;
  // Shrink to the available side instead of clamping a full-height panel over
  // the launcher. This also keeps dragged positions usable on small screens.
  const windowHeight = Math.min(viewport.width <= 700 ? 600 : 620, openAbove ? spaceAbove : spaceBelow);

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
          className={"student-fif-window" + (dragging ? " is-dragging" : "")}
          style={windowStyle}
          role="dialog"
          aria-label="FIF AI assistant"
        >
          <header className="student-fif-window-head" onPointerDown={startDrag}>
            <div className="student-fif-window-brand">
              <span className="student-fif-window-badge">
                <img src="/brand/ap-monogram-v2.png" alt="" width="20" height="20" />
              </span>
              <div>
                <strong>FIF AI</strong>
                <small>Campus pickup assistant</small>
              </div>
            </div>
            <div className="student-fif-window-controls">
              <GripHorizontal size={16} className="student-fif-drag-hint" aria-hidden />
              <button
                type="button"
                className="student-fif-window-close"
                aria-label="Start new chat"
                title="Start new chat"
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
                className="student-fif-window-close"
                aria-label="Close FIF AI"
                onClick={() => setOpen(false)}
              >
                <X size={18} aria-hidden />
              </button>
            </div>
          </header>
          <div className="student-fif-window-messages" ref={listRef} aria-live="polite">
            {messages.map((message) => (
              <div key={message.id} className={"student-fif-msg student-fif-msg-" + message.role}>
                <div className="student-fif-msg-bubble">
                  {message.role === "assistant" ? <RichText text={message.text} /> : message.text}
                </div>
                {message.cartAction && (
                  <div className="student-fif-msg-links">
                    <button
                      type="button"
                      className="student-fif-msg-link"
                      disabled={pending || message.actionState === "added"}
                      onClick={() => void addPreparedCart(message)}
                    >
                      {message.actionState === "added" ? "Added to cart" : "Add to cart"}
                    </button>
                  </div>
                )}
                {message.links?.length ? (
                  <div className="student-fif-msg-links">
                    {message.links.map((link) => (
                      <Link key={link.href} href={link.href} className="student-fif-msg-link">
                        {link.label}
                        <ArrowRight size={13} aria-hidden />
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {pending && (
              <div className="student-fif-msg student-fif-msg-assistant" role="status">
                <div className="student-fif-msg-bubble">
                  <p>Checking…</p>
                </div>
              </div>
            )}
            {messages.length === 1 && (
              <div className="student-fif-prompts">
                {starterPrompts.map((prompt) => (
                  <button type="button" key={prompt} onClick={() => void send(prompt)}>
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>
          <form
            className="student-fif-window-form"
            onSubmit={(event) => {
              event.preventDefault();
              void send(draft);
            }}
          >
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask FIF AI anything…"
              aria-label="Message FIF AI"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={240}
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
        className={"student-fif-launcher" + (dragging ? " is-dragging" : "")}
        style={launcherStyle}
        aria-expanded={open}
        aria-label={open ? "Close FIF AI" : "Open FIF AI"}
        onPointerDown={startDrag}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          setOpen((value) => !value);
        }}
      >
        <span className="student-fif-launcher-logo">
          <img src="/brand/ap-monogram-v2.png" alt="" width="18" height="18" />
        </span>
        <span>FIF AI</span>
      </button>
    </>
  );
}
