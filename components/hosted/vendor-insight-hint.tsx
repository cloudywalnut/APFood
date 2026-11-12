"use client";

import { ArrowDown, X } from "lucide-react";

export function VendorInsightHint({ count, view, close }: { count: number; view: () => void; close: () => void }) {
  return (
    <aside className="vendor-insight-hint" aria-label="AI Insights ready">
      <img src="/brand/ap-monogram-v2.png" alt="" width={34} height={34} />
      <div>
        <strong>AI Insights</strong>
        <p role="status">{count} recommendations ready. Taking you to your insights.</p>
        <button type="button" onClick={view}>View recommendations <ArrowDown size={13} aria-hidden /></button>
      </div>
      <button type="button" className="vendor-insight-hint-close" aria-label="Dismiss AI Insights hint" onClick={close}>
        <X size={16} aria-hidden />
      </button>
    </aside>
  );
}
