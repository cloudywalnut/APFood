"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, Settings, ShieldCheck, UserRound } from "lucide-react";
import { createHostedData, hostedData } from "../../lib/backend/client";
import { Brand, ErrorMessage, Footer } from "../shared";
import { HostedFrame, messageOf, portalFor, RemoteStatus, useRemote, type Role } from "./common";
import { useHostedSession } from "./session-provider";
import { canUseWorkspace, loginDestination } from "../../lib/login-routing";
import { AccountMenu } from "../account-menu";

const workspaceLabels: Record<Role, string> = {
  student: "Order campus food",
  vendor: "Vendor dashboard",
  admin: "Admin dashboard",
};

function PasswordField({ label = "Password", name = "password", autoComplete = "new-password", minLength = 12, required = true }: {
  label?: string; name?: string; autoComplete?: string; minLength?: number; required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return <label className="field">{label}<div className="password-input">
    <input name={name} type={visible ? "text" : "password"} required={required} minLength={minLength} maxLength={128} autoComplete={autoComplete} />
    <button type="button" className="icon-button" aria-label={(visible ? "Hide " : "Show ") + label.toLowerCase()} onClick={() => setVisible(!visible)}>
      {visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
    </button>
  </div></label>;
}

function returnPath(value: string | null) {
  return value && /^\/(?!\/)/.test(value) && !/[\\\r\n]/.test(value) ? value : undefined;
}

export function AuthScreen({ screen }: { screen: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.get("error") ? "This link has expired or was already used. Request a fresh email below." : "");
  const [notice, setNotice] = useState("");
  const signup = screen === "register";
  const verify = screen === "verify-email";
  const recover = screen === "forgot-password";
  const reset = screen === "reset-password" || screen === "accept-invite";
  const titles: Record<string, string> = {
    login: "Welcome back.", register: "Your next lunch starts here.",
    "verify-email": "Check your inbox.", "forgot-password": "Let's get you back in.",
    "reset-password": "Choose a new password.", "accept-invite": "Welcome to the team.",
  };
  const next = returnPath(params.get("next"));
  return <HostedFrame authRole="student"><div className="auth-heading"><span className="auth-icon">{reset ? <LockKeyhole aria-hidden /> : verify || recover ? <Mail aria-hidden /> : <UserRound aria-hidden />}</span>
    <span className="section-label">Welcome to APFoods</span><h1>{titles[screen]}</h1>
    <p>{signup ? "Create your account to save your cart and pick up food between classes."
      : verify ? "Open the confirmation email to activate your account." : recover ? "We'll email you a link to reset your password."
        : reset ? "Use at least 12 characters to secure your account." : "Order ahead, keep track of your pickups, and make time for your day."}</p></div>
    <form className="stack" onSubmit={async event => {
      event.preventDefault();
      if (busy) return;
      const data = new FormData(event.currentTarget);
      const email = String(data.get("email") ?? "");
      const password = String(data.get("password") ?? "");
      if (reset && password !== data.get("confirm")) { setError("The passwords do not match."); return; }
      setBusy(true); setError(""); setNotice("");
      try {
        if (signup) {
          await hostedData.register({ email, password, displayName: String(data.get("name")) });
          router.push("/auth/verify-email?email=" + encodeURIComponent(email));
        } else if (verify || recover) {
          if (verify) await hostedData.resend(email); else await hostedData.recover(email);
          setNotice("If this email can receive the link, a new message will arrive shortly.");
        } else if (reset) {
          await hostedData.updateProfile({ password });
          setNotice("Password saved. You can continue to your workspace.");
        } else {
          const session = await hostedData.signIn(email, password);
          if (session.profile.status !== "active") { setError("Your account is suspended. Contact cafeteria support."); return; }
          router.push(loginDestination(session, next));
          router.refresh();
        }
      } catch (problem) { setError(messageOf(problem)); } finally { setBusy(false); }
    }}>
      {signup && <label className="field">Your name<input name="name" autoComplete="name" required maxLength={80} /></label>}
      {!reset && <label className="field">Email address<input name="email" type="email" autoComplete="email" required defaultValue={params.get("email") ?? ""} /></label>}
      {!verify && !recover && <PasswordField autoComplete={signup || reset ? "new-password" : "current-password"} minLength={signup || reset ? 12 : 1} />}
      {screen === "login" && <div className="auth-recovery-link"><Link href="/auth/forgot-password">Forgot password?</Link></div>}
      {reset && <PasswordField label="Confirm password" name="confirm" />}
      {signup && <p className="small muted">By creating an account you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>}
      <ErrorMessage message={error} />
      {notice && <p className="success" role="status">{notice}</p>}
      <button className="button primary" disabled={busy}>{busy ? "Please wait…" : signup ? "Create account" : verify ? "Resend confirmation" : recover ? "Send reset link" : reset ? "Save password" : "Sign in"}</button>
      {reset && notice && <Link className="button secondary" href="/auth/login">Continue to workspace</Link>}
    </form>
    <div className="auth-account-link">{screen === "login" ? <p>New to APFoods? <Link href={"/auth/register" + (next ? "?next=" + encodeURIComponent(next) : "")}>Create an account</Link></p> : <Link href="/auth/login">Back to sign in</Link>}</div>
    <nav className="auth-secondary-links" aria-label="Explore APFoods"><Link href="/app">Browse campus food</Link></nav>
  </HostedFrame>;
}

export function AccountScreen() {
  const router = useRouter();
  const result = useHostedSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const session = result.value;
  const guest = typeof result.error === "object" && result.error !== null && "status" in result.error && result.error.status === 401;
  useEffect(() => {
    if (guest) router.replace("/auth/login?next=%2Faccount");
  }, [guest, router]);
  if (!session) {
    return <HostedFrame authRole="student">
      {result.error && !guest ? <>
        <div className="auth-heading"><span className="section-label">APFoods Account</span><h1>Your account</h1></div>
        <RemoteStatus error={result.error} reload={result.reload} />
      </> : <>
        <div className="auth-heading">
          <span className="section-label">Welcome to APFoods</span>
          <h1>{guest ? "Sign in to your account" : "Your account"}</h1>
          <p role={!guest ? "status" : undefined}>{guest ? "Redirecting you to sign in so you can manage your profile, email, and password." : "Checking your session…"}</p>
        </div>
        <div className="stack">
          {guest && <Link className="button primary" href="/auth/login?next=%2Faccount">Log in</Link>}
          <Link className="button secondary" href="/app">Browse campus food</Link>
        </div>
      </>}
    </HostedFrame>;
  }
  const api = createHostedData(session.userId);
  const workspace = loginDestination(session);
  const settingsHref = workspace.startsWith("/vendor") ? "/vendor/settings" : workspace.startsWith("/admin") ? "/admin/settings" : "/app/settings";
  const initials = session.profile.display_name.trim().slice(0, 1).toUpperCase() || "A";
  const foodTiles = [
    { src: "/food/lunch.webp", alt: "Chilli chicken and rice" },
    { src: "/food/noodles.webp", alt: "Wok-tossed chicken noodles" },
    { src: "/food/coffee.webp", alt: "Iced kopi and toast" },
    { src: "/food/bowl.webp", alt: "Sesame tofu rice bowl" },
  ];
  return <div className="student-theme account-shell">
    <header className="account-topbar">
      <div>
        <Brand href={workspace} />
        <div className="account-topbar-links">
          <AccountMenu hosted settingsHref={settingsHref} />
          <Link className="quiet-link" href={workspace}><ArrowLeft size={16} aria-hidden />Your dashboard</Link>
          <Link className="button secondary" href={settingsHref}><Settings size={15} aria-hidden />Settings</Link>
        </div>
      </div>
    </header>
    <main id="main-content" className="account-main">
      <section className="account-hero">
        <div className="account-hero-copy">
          <span className="account-eyebrow">YOUR CAMPUS ACCOUNT</span>
          <div className="account-identity">
            <span className="account-avatar" aria-hidden="true">{initials}</span>
            <div>
              <h1>{session.profile.display_name}</h1>
              <p>{session.email}</p>
            </div>
          </div>
          <div className="account-badges">
            <span className={"badge " + (session.emailVerified ? "good" : "warning")}>
              <CheckCircle2 size={13} aria-hidden />{session.emailVerified ? "Email verified" : "Email awaiting confirmation"}
            </span>
            <span className="badge neutral">
              <ShieldCheck size={13} aria-hidden />{session.profile.status === "active" ? "Active account" : session.profile.status}
            </span>
          </div>
          <div className="account-workspaces">
            {session.memberships.filter(entry => canUseWorkspace(session, entry.role)).map(entry => <Link className="button secondary" key={entry.role + entry.vendor_id} href={portalFor[entry.role]}>
              {workspaceLabels[entry.role]}<ArrowRight size={15} aria-hidden />
            </Link>)}
          </div>
        </div>
        <div className="account-food-mosaic" aria-hidden="true">
          {foodTiles.map(tile => <div key={tile.src}><Image src={tile.src} alt="" fill sizes="180px" /></div>)}
        </div>
      </section>

      {(error || notice) && <div className="account-feedback">
        <ErrorMessage message={error} />
        {notice && <p className="success" role="status">{notice}</p>}
      </div>}

      <div className="account-grid">
        <div className="account-col">
          <form className="panel stack account-card" onSubmit={async event => {
            event.preventDefault(); const data = new FormData(event.currentTarget);
            setBusy(true); setError(""); setNotice("");
            try { await api.updateProfile({ displayName: String(data.get("name")) }); result.reload(); setNotice("Your name was updated."); }
            catch (problem) { setError(messageOf(problem)); } finally { setBusy(false); }
          }}>
            <div>
              <h2>Profile details</h2>
              <p className="muted small">Shown on your campus orders and receipts.</p>
            </div>
            <label className="field">Your name<input name="name" autoComplete="name" defaultValue={session.profile.display_name} required maxLength={80} /></label>
            <button className="button primary" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
          </form>

          <section className="panel account-card account-shortcuts">
            <div className="account-shortcut-photo">
              <Image src="/cafeteria/stalls/campus-noodle-bar-storefront.jpg" alt="" fill sizes="120px" />
            </div>
            <div>
              <h2>Ready for your next break?</h2>
              <p className="muted small">Browse stalls on the campus map or check your active pickups.</p>
              <div className="line wrap">
                <Link className="button secondary" href="/app">Browse stalls</Link>
                <Link className="quiet-link" href="/app/orders">My orders<ArrowRight size={15} aria-hidden /></Link>
              </div>
            </div>
          </section>
        </div>

        <form className="panel stack account-card" onSubmit={async event => {
          event.preventDefault(); const data = new FormData(event.currentTarget);
          const password = String(data.get("password") ?? "");
          if (password && password !== data.get("confirm")) { setError("The passwords do not match."); return; }
          setBusy(true); setError(""); setNotice("");
          try {
            await api.updateProfile({ email: String(data.get("email")) || undefined, password: password || undefined, currentPassword: String(data.get("currentPassword")) });
            setNotice("Security details saved. Check your inbox if you changed your email.");
            event.currentTarget?.reset();
          } catch (problem) { setError(messageOf(problem)); } finally { setBusy(false); }
        }}>
          <div>
            <h2>Email &amp; password</h2>
            <p className="muted small">Enter your current password before changing your email or password.</p>
          </div>
          <PasswordField label="Current password" name="currentPassword" autoComplete="current-password" minLength={1} />
          <label className="field">New email (optional)<input name="email" type="email" autoComplete="email" placeholder="you@campus.edu" /></label>
          <PasswordField label="New password (optional)" name="password" autoComplete="new-password" minLength={12} required={false} />
          <PasswordField label="Confirm new password" name="confirm" autoComplete="new-password" minLength={12} required={false} />
          <button className="button primary" disabled={busy}>{busy ? "Updating…" : "Update security details"}</button>
        </form>
      </div>
    </main>
    <Footer />
  </div>;
}
