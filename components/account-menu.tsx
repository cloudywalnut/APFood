"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings, UserRound } from "lucide-react";
import { hostedData } from "../lib/backend/client";
import { signOutPreview } from "../lib/preview-auth";

export function AccountMenu({ hosted, settingsHref = "/app/settings" }: { hosted: boolean; settingsHref?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const router = useRouter();
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  return <div className="account-menu" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }} onKeyDown={event => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } }}>
    <button ref={trigger} type="button" className="market-account" aria-label="Your account" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}><UserRound size={19} aria-hidden /><span>Your account</span></button>
    {open && <nav id={panelId} className="account-menu-panel" aria-label="Account options"><Link href={hosted ? "/account" : settingsHref} onClick={() => setOpen(false)}><UserRound size={17} aria-hidden />View account</Link><Link href={settingsHref} onClick={() => setOpen(false)}><Settings size={17} aria-hidden />Settings</Link><button type="button" disabled={busy} onClick={async () => {
      setBusy(true); setError("");
      try {
        if (hosted) await hostedData.signOut();
        else signOutPreview();
        setOpen(false); router.replace("/auth/login"); router.refresh();
      } catch (problem) { setError(problem instanceof Error ? problem.message : "Could not log out. Please try again."); }
      finally { setBusy(false); }
    }}><LogOut size={17} aria-hidden />{busy ? "Logging out…" : "Log out"}</button>{error && <p role="alert">{error}</p>}</nav>}
  </div>;
}
