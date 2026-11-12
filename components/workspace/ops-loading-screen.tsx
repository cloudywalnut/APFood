"use client";

import { useEffect, useState } from "react";

/**
 * Full-screen splash shown ONCE per session when the user first lands on a
 * vendor or admin page. It runs for a fixed minimum time (1.4 s) so the brand
 * moment is visible, then fades out. It never re-appears on subsequent route
 * changes within the same session — those show the normal per-section skeleton.
 */

const SESSION_KEY = "ap-food-ops-splash-shown";
const MIN_MS = 1400; // minimum visible time

export function OpsLoadingScreen() {
  // Only show if this session hasn't seen the splash yet.
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    return !sessionStorage.getItem(SESSION_KEY);
  });
  const [exiting, setExiting] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!visible) return;

    // Mark as shown immediately so navigation within the session skips it.
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* ignore */ }

    // Animate bar 0 → 90% over MIN_MS, then jump to 100% and fade out.
    let raf: ReturnType<typeof requestAnimationFrame>;
    let start: number | undefined;
    const barDuration = MIN_MS * 0.9;

    function step(ts: number) {
      if (start === undefined) start = ts;
      const elapsed = ts - start;
      const pct = Math.min(90, (elapsed / barDuration) * 90);
      setProgress(pct);
      if (pct < 90) {
        raf = requestAnimationFrame(step);
      } else {
        // Hold briefly then finish.
        setTimeout(() => {
          setProgress(100);
          setExiting(true);
          setTimeout(() => setVisible(false), 340);
        }, MIN_MS - elapsed > 0 ? MIN_MS - elapsed : 0);
      }
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className={"ops-loading-screen" + (exiting ? " is-done" : "")}
      role="status"
      aria-label="Loading workspace"
    >
      <div className="ops-loading-brand">
        <div className="ops-loading-logo-row">
          <img src="/brand/apfoods-wordmark-v1.png" alt="AP Food" className="ops-loading-wordmark" />
          <span className="ops-loading-sep" aria-hidden>×</span>
          <span className="ops-loading-fif">FIF AI</span>
        </div>
        <div className="ops-loading-bar-track" aria-hidden>
          <div className="ops-loading-bar-fill" style={{ width: progress + "%" }} />
        </div>
      </div>
    </div>
  );
}
