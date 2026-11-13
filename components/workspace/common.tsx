"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Brand, ErrorMessage, Footer } from "../shared";
import { createApiClient, apiClient } from "../../lib/backend/client";
import { RoleHero } from "../ui/role-hero";
import { useHostedSession } from "../hosted/session-provider";
import { canUseWorkspace } from "../../lib/login-routing";
import { isNativeMobile } from "../../lib/native-mobile";
import { clearStudentFifChats } from "../../lib/student-fif-chat-storage";

export type Session = Awaited<ReturnType<typeof apiClient.session>>;
export type Role = Session["memberships"][number]["role"];
export const portalFor: Record<Role, string> = { student: "/app", vendor: "/vendor", admin: "/admin" };
const roles: Role[] = ["student", "vendor", "admin"];
const SessionUserContext = createContext<string | null>(null);

/** Set to true inside OpsShell so RemoteStatus shows the branded loading overlay. */
export const OpsShellContext = createContext(false);

export function OptionalSession({ children }: { children: (session?: Session) => ReactNode }) {
  const result = useHostedSession();
  if (!result.value && !result.error)
    return (
      <AuthFrame>
        <p role="status">Loading your workspace…</p>
      </AuthFrame>
    );
  const guest =
    typeof result.error === "object" &&
    result.error !== null &&
    "status" in result.error &&
    result.error.status === 401;
  if (result.error && !guest)
    return (
      <AuthFrame>
        <RemoteStatus error={result.error} reload={result.reload} />
      </AuthFrame>
    );
  const session = result.value;
  return (
    <SessionUserContext.Provider value={session?.userId ?? null} key={session?.userId ?? "guest"}>
      {children(session)}
    </SessionUserContext.Provider>
  );
}

export function useSessionUser() {
  return useContext(SessionUserContext);
}

export function useApi() {
  const user = useContext(SessionUserContext);
  return useMemo(() => {
    if (!user) throw new Error("A signed-in session is required.");
    return createApiClient(user);
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
      if (running) {
        queued = true;
        return;
      }
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
    refresh.current = () => {
      void run();
    };
    void run();
    return () => {
      current = false;
    };
  }, [load]);
  return { ...(result.source === load ? result : {}), reload };
}

export function RemoteStatus({ error, reload }: { error?: unknown; reload: () => void }) {
  const isOps = useContext(OpsShellContext);
  if (error) {
    return (
      <div className="panel stack">
        <ErrorMessage message={messageOf(error)} />
        <div className="line wrap">
          <button className="button secondary" onClick={reload}>
            Retry
          </button>
          {typeof error === "object" && error !== null && "status" in error && error.status === 401 && (
            <Link className="button primary" href="/auth/login">
              Sign in
            </Link>
          )}
        </div>
      </div>
    );
  }
  // Inside vendor/admin shells, show the branded AP × FIF AI loading overlay.
  if (isOps) {
    return (
      <div className="ops-loading-screen ops-loading-inline" role="status" aria-label="Loading">
        <div className="ops-loading-brand">
          <div className="ops-loading-logo-row">
            <img src="/brand/apfoods-wordmark-v1.png" alt="AP Food" className="ops-loading-wordmark" />
            <span className="ops-loading-sep" aria-hidden>
              ×
            </span>
            <span className="ops-loading-fif">FIF AI</span>
          </div>
          <div className="ops-loading-bar-track" aria-hidden>
            <div className="ops-loading-bar-fill ops-loading-bar-indeterminate" />
          </div>
        </div>
      </div>
    );
  }
  return (
    <p className="muted" role="status">
      Loading…
    </p>
  );
}

export function AuthFrame({ children, authRole }: { children: ReactNode; authRole?: Role }) {
  if (authRole)
    return (
      <div className="student-theme">
        <main id="main-content" className="ap-login-page ap-auth-page">
          <section className="ap-login-brand">
            <Brand />
            <div className="ap-login-story">
              <span className="caf-eyebrow">A LITTLE LESS WAIT. A LOT MORE CAMPUS.</span>
              <h1>
                Your campus.
                <br />
                Your next good meal.
              </h1>
              <p>
                Order ahead, pick up on time.
                <br />
                Make more of your campus break.
              </p>
              <RoleHero role={authRole} artworkOnly />
            </div>
          </section>
          <section className="ap-login-form-side">
            <div className="ap-auth-panel">
              <div className="ap-login-form">{children}</div>
              <Footer compact />
            </div>
          </section>
        </main>
      </div>
    );
  return (
    <div className="student-theme public-shell">
      <header className="student-header">
        <div className="student-bar">
          <Brand />
        </div>
      </header>
      <main id="main-content" className="student-main public-main">
        <section className="policy">{children}</section>
      </main>
      <Footer />
    </div>
  );
}

function PortalLinks({ session }: { session: Session }) {
  const native = isNativeMobile();
  const available = roles.filter((role) => canUseWorkspace(session, role) && (!native || role === "student"));
  return available.length ? (
    <div className="entrances auth-entrances">
      {available.map((role) => (
        <Link href={portalFor[role]} key={role}>
          <strong>Continue as {role}</strong>
        </Link>
      ))}
    </div>
  ) : (
    <p>
      {native
        ? "The mobile app is exclusively for students. Please use a desktop web browser for vendor and admin workspaces."
        : "This account has no AP Food membership."}
    </p>
  );
}

export function SignOut() {
  const router = useRouter();
  const user = useContext(SessionUserContext);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="line wrap">
      <button
        className="button danger ap-signout-btn"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await createApiClient(user ?? undefined).signOut();
            clearStudentFifChats();
            router.replace("/");
            router.refresh();
          } catch (problem) {
            setError(messageOf(problem));
            setBusy(false);
          }
        }}
      >
        <LogOut size={16} aria-hidden />
        {busy ? "Logging out…" : "Log out"}
      </button>
      <ErrorMessage message={error} />
    </div>
  );
}

export function WorkspaceAccess({ role, children }: { role: Role; children: (session: Session) => ReactNode }) {
  const session = useHostedSession();
  if (!session.value) {
    const guest =
      typeof session.error === "object" &&
      session.error !== null &&
      "status" in session.error &&
      session.error.status === 401;
    return (
      <AuthFrame authRole={guest ? "student" : undefined}>
        {guest ? (
          <>
            <div className="auth-heading">
              <span className="section-label">Welcome to APFoods</span>
              <h1>Sign in to continue</h1>
              <p>Your orders, reports and workspace tools are available after sign-in.</p>
            </div>
            <div className="stack">
              <Link className="button primary" href="/auth/login">
                Log in
              </Link>
              <Link className="button secondary" href="/app">
                Browse campus food
              </Link>
            </div>
          </>
        ) : (
          <RemoteStatus error={session.error} reload={session.reload} />
        )}
      </AuthFrame>
    );
  }
  if (!session.value.emailVerified)
    return (
      <AuthFrame>
        <h1>Confirm your email</h1>
        <p>Verify your email to continue.</p>
        <Link className="button primary" href="/auth/verify-email">
          Resend confirmation
        </Link>
        <SignOut />
      </AuthFrame>
    );
  if (session.value.profile.status !== "active")
    return (
      <AuthFrame>
        <h1>Account suspended</h1>
        <p>Contact cafeteria support to review your account.</p>
        <SignOut />
      </AuthFrame>
    );
  if (role !== "student" && isNativeMobile())
    return (
      <AuthFrame authRole="student">
        <div className="auth-heading">
          <span className="section-label">APFoods Mobile</span>
          <h1>Student App Only</h1>
          <p>
            The mobile app is exclusively for students and campus pickups. Please access the{" "}
            {role === "admin" ? "Admin Command Centre" : "Vendor Kitchen Board"} using a desktop web browser.
          </p>
        </div>
        <div className="stack">
          <Link className="button primary" href="/app">
            Open Student Marketplace
          </Link>
          <SignOut />
        </div>
      </AuthFrame>
    );
  if (!canUseWorkspace(session.value, role))
    return (
      <AuthFrame>
        <h1>Workspace unavailable</h1>
        <p>Choose a workspace assigned to your account.</p>
        <PortalLinks session={session.value} />
        <SignOut />
      </AuthFrame>
    );
  return (
    <SessionUserContext.Provider value={session.value.userId} key={session.value.userId + ":" + role}>
      {children(session.value)}
    </SessionUserContext.Provider>
  );
}
