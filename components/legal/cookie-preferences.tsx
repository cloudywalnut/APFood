"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Cookie, ShieldCheck } from "lucide-react";
import { choosePreferenceCookies, readCookieChoice, usePreferences } from "../../lib/preferences";

export function PreferenceCookies() {
  usePreferences();
  const path = usePathname();
  const [ready, setReady] = useState(false);
  const [chosen, setChosen] = useState(false);
  useEffect(() => {
    const refresh = () => {
      setChosen(Boolean(readCookieChoice()));
      setReady(true);
    };
    refresh();
    window.addEventListener("ap-preferences", refresh);
    return () => window.removeEventListener("ap-preferences", refresh);
  }, []);
  if (!ready || chosen || path === "/cookies") return null;
  return (
    <section className="cookie-choice-banner" aria-label="Cookie preferences">
      <div className="cookie-choice-icon">
        <Cookie size={22} aria-hidden />
      </div>
      <div>
        <h2>A few preferences, remembered.</h2>
        <p>
          Essential storage keeps sign-in and your basket working. Optional cookies remember your display preferences
          for your next visit.
        </p>
        <Link href="/cookies">Manage cookies</Link>
      </div>
      <div className="cookie-choice-actions">
        <button className="button primary" onClick={() => choosePreferenceCookies(true)}>
          Remember preferences
        </button>
        <button className="button secondary" onClick={() => choosePreferenceCookies(false)}>
          Essential only
        </button>
      </div>
    </section>
  );
}

export function CookiePreferenceControls() {
  const [enabled, setEnabled] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setEnabled(readCookieChoice()?.preferences ?? false);
  }, []);
  return (
    <section className="legal-cookie-choices">
      <h2>Your cookie choices</h2>
      <div className="legal-cookie-row">
        <div>
          <strong>
            <ShieldCheck size={17} aria-hidden />
            Essential storage
          </strong>
          <p>Sign-in, your basket, checkout recovery and this cookie choice.</p>
        </div>
        <span>Always active</span>
      </div>
      <div className="legal-cookie-row">
        <div>
          <strong>Remember my preferences</strong>
          <p>
            Save list density, display timezone and in-app update settings for 180 days on this browser. No advertising
            or analytics cookies.
          </p>
        </div>
        <label className="cookie-toggle">
          <input
            type="checkbox"
            aria-label="Allow preference cookies"
            checked={enabled}
            onChange={(event) => {
              setEnabled(event.target.checked);
              setSaved(false);
            }}
          />
          <span aria-hidden />
        </label>
      </div>
      <button
        className="button primary"
        onClick={() => {
          choosePreferenceCookies(enabled);
          setSaved(true);
        }}
      >
        Save cookie choices
      </button>
      {saved && (
        <p className="success" role="status">
          Cookie choices saved.
        </p>
      )}
    </section>
  );
}
