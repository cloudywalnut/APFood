"use client";

import { useEffect, useState } from "react";

/**
 * App-wide branded AP Food x FIF AI splash screen.
 * Displays on the first visit of the session to give a polished brand feel,
 * then smoothly fades away. Never re-appears on in-session navigation.
 */
const SPLASH_SESSION_KEY = "ap-food-splash-shown";
const MIN_SPLASH_MS = 1200;

export function AppSplashScreen() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setMounted(true);
    try {
      const alreadyShown = sessionStorage.getItem(SPLASH_SESSION_KEY);
      if (!alreadyShown) {
        setVisible(true);
        sessionStorage.setItem(SPLASH_SESSION_KEY, "1");
      }
    } catch {
      // If sessionStorage is unavailable, do not block the UI
    }
  }, []);

  useEffect(() => {
    if (!visible) return;

    let raf: ReturnType<typeof requestAnimationFrame>;
    let start: number | undefined;
    const barDuration = MIN_SPLASH_MS * 0.85;

    function step(ts: number) {
      if (start === undefined) start = ts;
      const elapsed = ts - start;
      const pct = Math.min(92, (elapsed / barDuration) * 92);
      setProgress(pct);

      if (pct < 92) {
        raf = requestAnimationFrame(step);
      } else {
        const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
        setTimeout(() => {
          setProgress(100);
          setExiting(true);
          setTimeout(() => setVisible(false), 360);
        }, remaining);
      }
    }

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  if (!mounted || !visible) return null;

  return (
    <div
      className={"ops-loading-screen" + (exiting ? " ops-loading-fadeout" : "")}
      role="status"
      aria-label="Loading AP Food"
    >
      <div className="ops-loading-brand">
        <div className="ops-loading-logo-row">
          <img
            src="/brand/apfoods-wordmark-v1.png"
            alt="AP Food"
            className="ops-loading-wordmark"
          />
          <span className="ops-loading-sep" aria-hidden>
            ×
          </span>
          <span className="ops-loading-fif">FIF AI</span>
        </div>
        <div className="ops-loading-bar-track" aria-hidden>
          <div className="ops-loading-bar-fill" style={{ width: progress + "%" }} />
        </div>
      </div>
    </div>
  );
}
