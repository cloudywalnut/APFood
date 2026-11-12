"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Check, GripHorizontal, SendHorizontal, X } from "lucide-react";
import { createApiClient, hostedData } from "../../lib/backend/client";
import type { CopilotProposedAction } from "../../lib/backend/contracts";
import { money } from "../../lib/orders";
import { useSessionUser } from "../workspace/common";

type ActionState = "pending" | "applying" | "applied" | "cancelled" | "error";

type Message = {
  id: string;
  role: "assistant" | "user";
  text: string;
  source?: "gemini" | "rules";
  proposedAction?: CopilotProposedAction | null;
  actionVendorId?: string;
  actionState?: ActionState;
  actionError?: string;
};

type Position = { left: number; top: number };
type StallSummary = { id: string; name: string };

export type FifAssistantProps = {
  mode?: "student" | "vendor";
  hosted?: boolean;
  vendorId?: string;
};

const studentPrompts = ["Fastest pickup now", "Meal deals today", "Quiet stalls"];
const vendorPrompts = [
  "What should I prep for the next rush?",
  "Which item in my inventory would sell best in July?",
  "Restock my lowest-stock item by +15",
  "Pause any out-of-stock items",
];
const storageKey = "ap-food-fif-position";

type ActionDiffItem = { label: string; before: string; after: string };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function actionDiffItems(action: CopilotProposedAction): ActionDiffItem[] {
  if (action.type === "update_menu_item") {
    const items: ActionDiffItem[] = [];
    if (action.changes.stock !== undefined) {
      items.push({ label: "Stock", before: String(action.before.stock), after: String(action.changes.stock) });
    }
    if (action.changes.priceSen !== undefined) {
      items.push({ label: "Price", before: money(action.before.priceSen), after: money(action.changes.priceSen) });
    }
    if (action.changes.discountSen !== undefined) {
      items.push({
        label: "Discount",
        before: money(action.before.discountSen),
        after: money(action.changes.discountSen),
      });
    }
    if (action.changes.active !== undefined) {
      items.push({
        label: "Status",
        before: action.before.active ? "Published" : "Hidden",
        after: action.changes.active ? "Published" : "Hidden",
      });
    }
    return items;
  }
  const items: ActionDiffItem[] = [];
  if (action.changes.paused !== undefined) {
    items.push({
      label: "Intake",
      before: action.before.paused ? "Paused" : "Open",
      after: action.changes.paused ? "Paused" : "Open",
    });
  }
  if (action.changes.capacity !== undefined) {
    items.push({ label: "Capacity", before: `${action.before.capacity} u`, after: `${action.changes.capacity} u` });
  }
  if (action.changes.leadMinutes !== undefined) {
    items.push({
      label: "Lead time",
      before: `${action.before.leadMinutes}m`,
      after: `${action.changes.leadMinutes}m`,
    });
  }
  return items;
}

export function FifAssistant({ mode = "student", hosted = false, vendorId }: FifAssistantProps) {
  const router = useRouter();
  const sessionUser = useSessionUser();
  const api = useMemo(() => createApiClient(sessionUser ?? undefined), [sessionUser]);
  const isHostedVendor = mode === "vendor" && hosted;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [stalls, setStalls] = useState<StallSummary[]>([]);
  const [pos, setPos] = useState<Position>();
  const [dragging, setDragging] = useState(false);
  const [viewport, setViewport] = useState({ width: 1200, height: 800 });
  const [launcherSize, setLauncherSize] = useState({ width: 112, height: 44 });
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: "welcome",
      role: "assistant",
      text: isHostedVendor
        ? "Hi! I’m FIF AI, your Vendor Copilot. Ask about your menu, stock, peak hours, July demand, or ask me to update an item with your confirmation."
        : "Hi! I’m FIF AI. Ask about stalls, meal deals, or pickup times.",
    },
  ]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const suppressClick = useRef(false);
  const prevVendorIdRef = useRef<string | undefined>(undefined);
  const sendRef = useRef<(text: string, vendorIdOverride?: string) => Promise<void>>(async () => {});

  const [urlStall, setUrlStall] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    return new URLSearchParams(window.location.search).get("stall") ?? undefined;
  });

  useEffect(() => {
    const syncStall = () => {
      const nextStall = new URLSearchParams(window.location.search).get("stall") ?? undefined;
      setUrlStall(nextStall);
    };
    window.addEventListener("popstate", syncStall);
    return () => window.removeEventListener("popstate", syncStall);
  }, []);

  const currentStallId = vendorId ?? urlStall;
  const activeStall = stalls.find((entry) => entry.id === currentStallId) ?? stalls[0];
  const resolvedVendorId = currentStallId ?? activeStall?.id;
  const starterPrompts = isHostedVendor ? vendorPrompts : studentPrompts;

  useEffect(() => {
    if (!isHostedVendor || !resolvedVendorId) return;
    if (prevVendorIdRef.current && prevVendorIdRef.current !== resolvedVendorId) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          text: "Hi! I’m FIF AI, your Vendor Copilot. Ask about your menu, stock, peak hours, July demand, or ask me to update an item with your confirmation.",
        },
      ]);
    }
    prevVendorIdRef.current = resolvedVendorId;
  }, [isHostedVendor, resolvedVendorId]);

  useEffect(() => {
    if (!isHostedVendor || stalls.length > 0) return;
    let cancelled = false;
    api
      .assignedStalls()
      .then((rows) => {
        if (!cancelled) setStalls(rows.map((row) => ({ id: row.id, name: row.name })));
      })
      .catch(() => {
        /* Keep fallback state if stalls fail to load. */
      });
    return () => {
      cancelled = true;
    };
  }, [isHostedVendor, stalls.length, api]);

  useEffect(() => {
    const syncViewport = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const rect = launcherRef.current?.getBoundingClientRect();
      const lWidth = rect?.width || 112;
      const lHeight = rect?.height || 44;
      setViewport({ width, height });
      setLauncherSize({ width: lWidth, height: lHeight });
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
  }, [messages, open, loading]);

  const loadingRef = useRef(false);
  loadingRef.current = loading;

  useEffect(() => {
    const onPrompt = (event: Event) => {
      const detail = (event as CustomEvent<{ prompt?: string; autoSend?: boolean; vendorId?: string }>).detail;
      const prompt = typeof detail?.prompt === "string" ? detail.prompt.trim().slice(0, 400) : "";
      setOpen(true);
      if (!prompt) {
        requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }
      if (detail?.autoSend === false || loadingRef.current) {
        setDraft(prompt);
        requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }
      void sendRef.current(prompt, detail?.vendorId);
    };
    window.addEventListener("apfood:copilot-prompt", onPrompt);
    return () => window.removeEventListener("apfood:copilot-prompt", onPrompt);
  }, []);

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

  async function send(text: string, vendorIdOverride?: string) {
    const clean = text.trim().slice(0, 400);
    if (!clean || loading) return;
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", text: clean };
    const history = messages
      .filter((entry) => entry.id !== "welcome" && entry.text.trim().length > 0)
      .slice(-8)
      .map((entry) => ({ role: entry.role, text: entry.text.trim().slice(0, 600) }));

    setMessages((previous) => [...previous, userMessage]);
    setDraft("");

    if (!isHostedVendor) {
      setMessages((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text:
            mode === "vendor"
              ? "Vendor AI Copilot requires a signed-in hosted vendor session. Sign in to chat with live stall data and guarded actions."
              : "FIF AI student chat is coming soon. Meanwhile, use SmartQueue and Campus Deals to pick the fastest stall.",
        },
      ]);
      return;
    }

    let targetVendorId: string | undefined = vendorIdOverride ?? resolvedVendorId;
    if (!targetVendorId) {
      try {
        const assigned = await api.assignedStalls();
        setStalls(assigned.map((row) => ({ id: row.id, name: row.name })));
        targetVendorId = vendorIdOverride ?? assigned[0]?.id;
      } catch {
        targetVendorId = undefined;
      }
    }

    if (!targetVendorId) {
      setMessages((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: "No assigned stall found for your vendor account yet.",
        },
      ]);
      return;
    }

    setLoading(true);
    try {
      const response = await api.vendorCopilot({
        vendorId: targetVendorId,
        message: clean,
        history,
      });
      setMessages((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: response.reply,
          source: response.source,
          proposedAction: response.proposedAction,
          actionVendorId: response.proposedAction ? targetVendorId : undefined,
          actionState: response.proposedAction ? "pending" : undefined,
        },
      ]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Could not reach FIF AI Copilot.";
      setMessages((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: detail,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }
  sendRef.current = send;

  async function confirmAction(messageId: string, action: CopilotProposedAction, actionVendorId?: string) {
    const targetVendorId = actionVendorId ?? resolvedVendorId;
    if (!targetVendorId) return;
    setMessages((previous) =>
      previous.map((entry) =>
        entry.id === messageId ? { ...entry, actionState: "applying", actionError: undefined } : entry,
      ),
    );
    try {
      const result = await api.executeVendorCopilot({
        vendorId: targetVendorId,
        action,
      });
      setMessages((previous) =>
        previous.map((entry) => (entry.id === messageId ? { ...entry, actionState: "applied" } : entry)),
      );
      setMessages((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: `Applied: ${result.appliedSummary}`,
        },
      ]);
      router.refresh();
      window.dispatchEvent(new Event("apfood:vendor-action-applied"));
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Failed to apply action.";
      setMessages((previous) =>
        previous.map((entry) =>
          entry.id === messageId ? { ...entry, actionState: "error", actionError: detail } : entry,
        ),
      );
    }
  }

  function cancelAction(messageId: string) {
    setMessages((previous) =>
      previous.map((entry) => (entry.id === messageId ? { ...entry, actionState: "cancelled" } : entry)),
    );
  }

  const windowWidth = Math.min(380, viewport.width - 24);
  const windowHeight = Math.max(320, Math.min(540, viewport.height - 96));
  const spaceAbove = pos ? pos.top - 22 : 0;
  const spaceBelow = pos ? viewport.height - (pos.top + launcherSize.height + 22) : 0;
  const openAbove = pos ? spaceAbove >= windowHeight || spaceAbove >= spaceBelow : true;

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
          ? {
              top: "auto",
              bottom: viewport.height - pos.top + 10,
              height: Math.min(windowHeight, Math.max(260, spaceAbove)),
            }
          : {
              top: pos.top + launcherSize.height + 10,
              bottom: "auto",
              height: Math.min(windowHeight, Math.max(260, spaceBelow)),
            }),
        right: "auto",
        width: windowWidth,
        transformOrigin: `${pos.left + launcherSize.width / 2 > viewport.width / 2 ? "right" : "left"} ${openAbove ? "bottom" : "top"}`,
      }
    : undefined;

  const subtitle = isHostedVendor
    ? activeStall
      ? `Vendor Copilot · ${activeStall.name}`
      : "Vendor AI Copilot"
    : "Campus pickup assistant";

  return (
    <>
      {open && (
        <section
          className={"fif-window" + (dragging ? " is-dragging" : "")}
          style={windowStyle}
          role="dialog"
          aria-label="FIF AI assistant"
        >
          <header className="fif-window-head" onPointerDown={startDrag}>
            <div className="fif-window-brand">
              <span className="fif-window-badge">
                <img src="/brand/ap-monogram-v2.png" alt="" width="20" height="20" />
              </span>
              <div>
                <strong>FIF AI</strong>
                <small>{subtitle}</small>
              </div>
            </div>
            <div className="fif-window-controls">
              <GripHorizontal size={16} className="fif-drag-hint" aria-hidden />
              <button
                type="button"
                className="fif-window-close"
                aria-label="Close FIF AI"
                onClick={() => setOpen(false)}
              >
                <X size={18} aria-hidden />
              </button>
            </div>
          </header>
          <div className="fif-window-messages" ref={listRef}>
            {messages.map((message) => (
              <div key={message.id} className={"fif-msg fif-msg-" + message.role}>
                <div className="fif-msg-body">
                  <p>{message.text}</p>
                  {message.proposedAction && (
                    <div className="fif-action-card">
                      <div className="fif-action-head">
                        <strong>Proposed change</strong>
                        {message.actionState === "applied" && (
                          <span className="fif-action-tag is-applied">
                            <Check size={12} aria-hidden /> Applied
                          </span>
                        )}
                        {message.actionState === "cancelled" && (
                          <span className="fif-action-tag is-cancelled">Cancelled</span>
                        )}
                      </div>
                      <p className="fif-action-summary">{message.proposedAction.summary}</p>
                      <div className="fif-action-diffs">
                        {actionDiffItems(message.proposedAction).map((item) => (
                          <div key={item.label} className="fif-action-diff-row">
                            <span className="fif-diff-label">{item.label}</span>
                            <span className="fif-diff-badges">
                              <span className="fif-diff-before">{item.before}</span>
                              <span className="fif-diff-arrow" aria-hidden>
                                →
                              </span>
                              <span className="fif-diff-after">{item.after}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                      {message.actionError && <p className="fif-action-error">{message.actionError}</p>}
                      {(message.actionState === "pending" ||
                        message.actionState === "applying" ||
                        message.actionState === "error") && (
                        <div className="fif-action-buttons">
                          <button
                            type="button"
                            className="fif-action-confirm"
                            disabled={message.actionState === "applying"}
                            onClick={() => confirmAction(message.id, message.proposedAction!, message.actionVendorId)}
                          >
                            {message.actionState === "applying" ? "Applying…" : "Confirm & Apply"}
                          </button>
                          <button
                            type="button"
                            className="fif-action-cancel"
                            disabled={message.actionState === "applying"}
                            onClick={() => cancelAction(message.id)}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="fif-msg fif-msg-assistant">
                <div className="fif-msg-body">
                  <p className="fif-typing">Thinking with live stall data…</p>
                </div>
              </div>
            )}
            {messages.length === 1 && !loading && (
              <div className="fif-prompts">
                {starterPrompts.map((prompt) => (
                  <button type="button" key={prompt} onClick={() => send(prompt)}>
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>
          <form
            className="fif-window-form"
            onSubmit={(event) => {
              event.preventDefault();
              send(draft);
            }}
          >
            <input
              ref={inputRef}
              type="text"
              placeholder={isHostedVendor ? "Ask about sales, July demand, or stock…" : "Ask FIF AI anything…"}
              aria-label="Message FIF AI"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={400}
              disabled={loading}
            />
            <button type="submit" aria-label="Send message" disabled={!draft.trim() || loading}>
              <SendHorizontal size={17} aria-hidden />
            </button>
          </form>
        </section>
      )}
      <button
        ref={launcherRef}
        type="button"
        className={"fif-launcher" + (dragging ? " is-dragging" : "")}
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
        <span className="fif-launcher-logo">
          <img src="/brand/ap-monogram-v2.png" alt="" width="18" height="18" />
        </span>
        <span>FIF AI</span>
      </button>
    </>
  );
}
