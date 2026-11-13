"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Settings, UserRound } from "lucide-react";
import { createApiClient } from "../lib/backend/client";
import { loginDestination } from "../lib/login-routing";
import { isNativeMobile } from "../lib/native-mobile";
import { clearStudentFifChats } from "../lib/student-fif-chat-storage";
import { useHostedSession } from "./hosted/session-provider";

export function AccountMenu() {
  const { value: session } = useHostedSession();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  if (!session) return null;
  const base = isNativeMobile() ? "/app" : loginDestination(session);
  return (
    <div className="ap-account-menu" ref={ref}>
      <button
        type="button"
        ref={trigger}
        className="ap-account-trigger"
        aria-label="Your account"
        aria-expanded={open}
        aria-controls="ap-account-options"
        onClick={() => setOpen(!open)}
      >
        <UserRound size={19} aria-hidden />
        <span>Your account</span>
        <ChevronDown size={14} aria-hidden />
      </button>
      {open && (
        <div id="ap-account-options" className="ap-account-options">
          <strong>{session.profile.display_name}</strong>
          <Link href="/account" onClick={() => setOpen(false)}>
            <UserRound size={16} aria-hidden />
            View account
          </Link>
          <Link
            href={base.startsWith("/auth/") || base === "/account" ? "/account" : base + "/settings"}
            onClick={() => setOpen(false)}
          >
            <Settings size={16} aria-hidden />
            Settings
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await createApiClient(session.userId).signOut();
                clearStudentFifChats();
                router.replace("/");
                router.refresh();
              } catch (problem) {
                setError(problem instanceof Error ? problem.message : "Could not log out. Try again.");
                setBusy(false);
              }
            }}
          >
            <LogOut size={16} aria-hidden />
            {busy ? "Logging out…" : "Log out"}
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}
