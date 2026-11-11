"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { createHostedData, hostedData } from "../../lib/backend/client";
import { ErrorMessage } from "../shared";
import { HostedFrame, messageOf, portalFor, SignOut, useRemote } from "./common";
import { loginDestination } from "../../lib/login-routing";

function PasswordField({ label = "Password", name = "password", autoComplete = "new-password", minLength = 12 }: {
  label?: string; name?: string; autoComplete?: string; minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return <label className="field">{label}<div className="password-input">
    <input name={name} type={visible ? "text" : "password"} required minLength={minLength} maxLength={128} autoComplete={autoComplete} />
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
    <span className="section-label">AP Food · Campus pickup</span><h1>{titles[screen]}</h1>
    <p>{signup ? "Create your account to save your cart and pick up food between classes."
      : verify ? "Open the confirmation email to activate your account." : recover ? "We'll email you a link to reset your password."
        : reset ? "Use at least 12 characters to secure your account." : "Sign in to your account and pick up where you left off."}</p></div>
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
      {reset && <PasswordField label="Confirm password" name="confirm" />}
      {signup && <p className="small muted">By creating an account you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>}
      <ErrorMessage message={error} />
      {notice && <p className="success" role="status">{notice}</p>}
      <button className="button primary" disabled={busy}>{busy ? "Please wait…" : signup ? "Create account" : verify ? "Resend confirmation" : recover ? "Send reset link" : reset ? "Save password" : "Sign in"}</button>
      {reset && notice && <Link className="button secondary" href="/auth/login">Continue to workspace</Link>}
    </form>
    <div className="auth-links">{screen === "login" && <><Link href="/auth/forgot-password">Forgot password?</Link><Link href={"/auth/register" + (next ? "?next=" + encodeURIComponent(next) : "")}>Create an account</Link></>}
      {screen !== "login" && <Link href="/auth/login">Back to sign in</Link>}<Link href="/app">Browse the menu</Link><Link href="/welcome">About APFoods</Link></div>
  </HostedFrame>;
}

export function AccountScreen() {
  const result = useRemote(hostedData.session);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const session = result.value;
  if (!session) return <HostedFrame><h1>Your account</h1><p>{result.error ? "Sign in to manage your account." : "Loading your account…"}</p><Link className="button primary" href="/auth/login?next=/account">Sign in</Link></HostedFrame>;
  const api = createHostedData(session.userId);
  return <HostedFrame><div className="line spread wrap"><h1>Your account</h1><SignOut /></div>
    <p>{session.email} · {session.emailVerified ? "Email verified" : "Email awaiting confirmation"} · {session.profile.status}</p>
    <div className="line wrap">{session.memberships.map(entry => <Link className="button secondary" key={entry.role + entry.vendor_id} href={portalFor[entry.role]}>Open {entry.role} workspace</Link>)}</div>
    <form className="stack account-form" onSubmit={async event => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      setBusy(true); setError(""); setNotice("");
      try { await api.updateProfile({ displayName: String(data.get("name")) }); result.reload(); setNotice("Your name was updated."); }
      catch (problem) { setError(messageOf(problem)); } finally { setBusy(false); }
    }}><h2>Profile</h2><label className="field">Your name<input name="name" autoComplete="name" defaultValue={session.profile.display_name} required maxLength={80} /></label>
      <button className="button primary" disabled={busy}>Save profile</button></form>
    <form className="stack account-form" onSubmit={async event => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      const password = String(data.get("password") ?? "");
      if (password && password !== data.get("confirm")) { setError("The passwords do not match."); return; }
      setBusy(true); setError(""); setNotice("");
      try {
        await api.updateProfile({ email: String(data.get("email")) || undefined, password: password || undefined, currentPassword: String(data.get("currentPassword")) });
        setNotice("Security details saved. Check your inbox if you changed your email.");
        event.currentTarget?.reset();
      } catch (problem) { setError(messageOf(problem)); } finally { setBusy(false); }
    }}><h2>Email and password</h2><PasswordField label="Current password" name="currentPassword" autoComplete="current-password" minLength={1} />
      <label className="field">New email (optional)<input name="email" type="email" autoComplete="email" /></label>
      <label className="field">New password (optional)<input name="password" type="password" minLength={12} autoComplete="new-password" /></label>
      <label className="field">Confirm new password<input name="confirm" type="password" autoComplete="new-password" /></label>
      <button className="button primary" disabled={busy}>Update security details</button></form>
    <ErrorMessage message={error} />{notice && <p className="success" role="status">{notice}</p>}
  </HostedFrame>;
}
