"use client";

import { useEffect, useState } from "react";

/**
 * Full-screen loading overlay for vendor and admin pages.
 * Shows "AP Food × FIF AI" branding with an orange progress bar.
 * Fades out once children have mounted and triggered onReady().
 */
export function OpsLoadingScreen({ onReady }: { onReady: (notify: () => void) => void }) {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Animate the bar quickly to ~80% then wait for onReady
    let raf: ReturnType<typeof requestAnimationFrame>;
    let start: number;
    const duration = 900; // ms to reach 80%

    function step(ts: number) {
      if (!start) start = ts;
      const elapsed = ts - start;
      const pct = Math.min(80, (elapsed / duration) * 80);
      setProgress(pct);
      if (pct < 80) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);

    onReady(() => {
      setProgress(100);
      setTimeout(() => setVisible(false), 320);
    });

    return () => cancelAnimationFrame(raf);
  }, [onReady]);

  if (!visible) return null;

  return (
    <div className="ops-loading-screen" role="status" aria-label="Loading workspace">
      <div className="ops-loading-brand">
        <div className="ops-loading-logo-row">
          <img src="/brand/apfoods-wordmark-v1.png" alt="AP Food" className="ops-loading-wordmark" />
          <span className="ops-loading-sep" aria-hidden>×</span>
          <span className="ops-loading-fif">FIF AI</span>
        </div>
        <div className="ops-loading-bar-track" aria-hidden>
          <div
            className="ops-loading-bar-fill"
            style={{ width: progress + "%" }}
          />
        </div>
      </div>
    </div>
  );
}
