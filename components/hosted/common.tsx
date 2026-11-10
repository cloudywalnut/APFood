"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brand, ErrorMessage, Footer } from "../shared";
import { createHostedData, hostedData, sessionInvalidated } from "../../lib/backend/client";

export type Session = Awaited<ReturnType<typeof hostedData.session>>;
export type Role = Session["memberships"][number]["role"];
export const portalFor: Record<Role, string> = { student: "/app", vendor: "/vendor", admin: "/admin" };
const roles: Role[] = ["student", "vendor", "admin"];
const HostedUser = createContext<string | null>(null);

export function useHostedData() {
  const user = useContext(HostedUser);
  return useMemo(() => {
    if (!user) throw new Error("A hosted session is required.");
    return createHostedData(user);
  }, [user]);
}

export function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "The request failed. Try again.";
}

export function useRemote<T>(load: () => Promise<T>) {
  const [result, setResult] = useState<{ value?: T; error?: unknown; source?: typeof load }>({});
  const refresh = useRef<() => void>(() => {});
  const reload = useCallback(() => refresh.current(), []);
  useEffect(() => {
    let current = true;
    let running = false;
    let queued = false;
    async function run() {
      if (!current) return;
      if (running) { queued = true; return; }
      running = true;
      do {
        queued = false;
        try {
          const value = await load();
          if (current) setResult({ value, source: load });
        } catch (error) {
          if (current) setResult({ error, source: load });
        }
      } while (current && queued);
      running = false;
    }
    refresh.current = () => { void run(); };
    void run();
    return () => { current = false; };
  }, [load]);
  return { ...(result.source === load ? result : {}), reload };
}

export function RemoteStatus({ error, reload }: { error?: unknown; reload: () => void }) {
  return error ? <div className="panel stack"><ErrorMessage message={messageOf(error)} /><div className="line wrap">
    <button className="button secondary" onClick={reload}>Retry</button>
    {typeof error === "object" && error !== null && "status" in error && error.status === 401 &&
      <Link className="button primary" href="/auth/login">Sign in</Link>}
  </div></div> : <p className="muted" role="status">Loading…</p>;
}

export function HostedFrame({ children }: { children: ReactNode }) {
  return <div className="student-theme public-shell">
    <header className="student-header"><div className="student-bar"><Brand /></div></header>
    <main id="main-content" className="student-main public-main"><section className="policy">{children}</section></main><Footer />
  </div>;
}

function PortalLinks({ session }: { session: Session }) {
  const available = roles.filter(role => session.memberships.some(entry => entry.role === role));
  return available.length ? <div className="entrances auth-entrances">{available.map(role =>
    <Link href={portalFor[role]} key={role}><strong>Continue as {role}</strong></Link>,
  )}</div> : <p>This account has no AP Food membership.</p>;
}

export function HostedLogin({ register = false }: { register?: boolean }) {
  const current = useRemote(hostedData.session);
  const [session, setSession] = useState<Session>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (register) return <HostedFrame><h1>Demo access</h1><p>Use the student, vendor, or admin account supplied for the hosted demo.</p><Link className="button primary" href="/auth/login">Sign in</Link></HostedFrame>;
  const active = session ?? current.value;
  return <HostedFrame><h1>{active ? "Choose your workspace" : "Sign in"}</h1>
    {active ? <><PortalLinks session={active} /><SignOut /></> : <form className="stack" onSubmit={async event => {
      event.preventDefault();
      if (busy) return;
      const data = new FormData(event.currentTarget);
      setBusy(true);
      setError("");
      try { setSession(await hostedData.signIn(String(data.get("email")), String(data.get("password")))); }
      catch (problem) { setError(messageOf(problem)); }
      finally { setBusy(false); }
    }}>
      <p>Use your hosted demo account.</p>
      <label className="field">Email<input name="email" type="email" autoComplete="username" required /></label>
      <label className="field">Password<input name="password" type="password" autoComplete="current-password" required /></label>
      <ErrorMessage message={error} />
      <button className="button primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>}
  </HostedFrame>;
}

export function SignOut() {
  const router = useRouter();
  const user = useContext(HostedUser);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <div className="line wrap"><button className="button secondary" disabled={busy} onClick={async () => {
    setBusy(true);
    try { await createHostedData(user ?? undefined).signOut(); router.replace("/"); router.refresh(); }
    catch (problem) { setError(messageOf(problem)); setBusy(false); }
  }}>Sign out</button><ErrorMessage message={error} /></div>;
}

export function HostedAccess({ role, children }: { role: Role; children: (session: Session) => ReactNode }) {
  const session = useRemote(hostedData.session);
  useEffect(() => {
    const visible = () => { if (document.visibilityState === "visible") session.reload(); };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener(sessionInvalidated, session.reload);
    return () => {
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener(sessionInvalidated, session.reload);
    };
  }, [session.reload]);
  if (!session.value) return <HostedFrame><h1>Hosted demo</h1><RemoteStatus error={session.error} reload={session.reload} /></HostedFrame>;
  if (!session.value.memberships.some(entry => entry.role === role)) return <HostedFrame><h1>Workspace unavailable</h1><p>Choose a workspace assigned to your account.</p><PortalLinks session={session.value} /><SignOut /></HostedFrame>;
  return <HostedUser.Provider value={session.value.userId} key={session.value.userId + ":" + role}>{children(session.value)}</HostedUser.Provider>;
}
