"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiError, hostedData, sessionInvalidated } from "../../lib/backend/client";

type Session = Awaited<ReturnType<typeof hostedData.session>>;
type SessionState = { value?: Session; error?: unknown; ready: boolean };
const SessionContext = createContext<(SessionState & { reload: () => void }) | null>(null);

export function HostedSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ ready: false });
  const pending = useRef<Promise<void> | null>(null);
  const generation = useRef(0);
  const checkedAt = useRef(0);
  const reload = useCallback(() => {
    if (pending.current) return;
    const version = generation.current;
    const task = (async () => {
      try {
        const value = await hostedData.session();
        if (version === generation.current) setState({ value, ready: true });
      } catch (error) {
        if (version === generation.current) setState(previous => ({
          value: error instanceof ApiError && error.status === 401 ? undefined : previous.value,
          error, ready: true,
        }));
      } finally {
        if (version === generation.current) { checkedAt.current = Date.now(); pending.current = null; }
      }
    })();
    pending.current = task;
  }, []);
  useEffect(() => {
    reload();
    const changed = (event: Event) => {
      const detail = (event as CustomEvent<{ session?: Session | null }>).detail;
      generation.current++; pending.current = null;
      if (detail && "session" in detail) {
        setState(detail.session ? { value: detail.session, ready: true } : { ready: true, error: new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.") });
        checkedAt.current = Date.now();
      } else { setState({ ready: false }); reload(); }
    };
    const refresh = () => { if (document.visibilityState === "visible" && Date.now() - checkedAt.current >= 60_000) reload(); };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener(sessionInvalidated, changed);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); window.removeEventListener(sessionInvalidated, changed); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [reload]);
  const value = useMemo(() => ({ ...state, reload }), [state, reload]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useHostedSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("HostedSessionProvider is required.");
  return session;
}
