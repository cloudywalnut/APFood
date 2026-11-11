"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brand, ErrorMessage, Footer } from "../shared";
import { createHostedData, hostedData, sessionInvalidated } from "../../lib/backend/client";
import { RoleHero } from "../apspace/role-hero";

export type Session = Awaited<ReturnType<typeof hostedData.session>>;
export type Role = Session["memberships"][number]["role"];
export const portalFor: Record<Role, string> = { student: "/app", vendor: "/vendor", admin: "/admin" };
const roles: Role[] = ["student", "vendor", "admin"];
const HostedUser = createContext<string | null>(null);

export function HostedVisitor({ children }: { children: (session?: Session) => ReactNode }) {
  const result = useRemote(hostedData.session);
  if (!result.value && !result.error) return <HostedFrame><p role="status">Loading your workspace…</p></HostedFrame>;
  const guest = typeof result.error === "object" && result.error !== null && "status" in result.error && result.error.status === 401;
  if (result.error && !guest) return <HostedFrame><RemoteStatus error={result.error} reload={result.reload} /></HostedFrame>;
  const session = result.value;
  return <HostedUser.Provider value={session?.userId ?? null} key={session?.userId ?? "guest"}>{children(session)}</HostedUser.Provider>;
}

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

export function HostedFrame({ children, authRole }: { children: ReactNode; authRole?: Role }) {
  if (authRole) return <div className="student-theme"><main id="main-content" className="ap-login-page"><section className="ap-login-brand"><Brand /><div className="ap-login-story"><span className="caf-eyebrow">A LITTLE LESS WAIT. A LOT MORE CAMPUS.</span><h1>Your campus.<br />Your next good meal.</h1><p>Order ahead, pick up on time.<br />Make more of your campus break.</p><RoleHero role={authRole} artworkOnly /></div></section><section className="ap-login-form-side"><div className="ap-login-form">{children}</div><Footer /></section></main></div>;
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
  if (!session.value.emailVerified) return <HostedFrame><h1>Confirm your email</h1><p>Verify your email to continue.</p><Link className="button primary" href="/auth/verify-email">Resend confirmation</Link><SignOut /></HostedFrame>;
  if (session.value.profile.status !== "active") return <HostedFrame><h1>Account suspended</h1><p>Contact cafeteria support to review your account.</p><SignOut /></HostedFrame>;
  if (!session.value.memberships.some(entry => entry.role === role)) return <HostedFrame><h1>Workspace unavailable</h1><p>Choose a workspace assigned to your account.</p><PortalLinks session={session.value} /><SignOut /></HostedFrame>;
  return <HostedUser.Provider value={session.value.userId} key={session.value.userId + ":" + role}>{children(session.value)}</HostedUser.Provider>;
}
