"use client";

import { useCallback, useEffect } from "react";
import { Recommendation } from "../shared";
import { RemoteStatus, useApi, useRemote } from "./common";

export function FifPanel({
  role,
  vendorId,
  zoneId,
}: {
  role: "student" | "vendor" | "admin";
  vendorId?: string;
  zoneId?: string;
}) {
  const api = useApi();
  const load = useCallback(
    () => api.recommendations({ role, vendorId: vendorId || undefined, zoneId: zoneId || undefined }),
    [api, role, vendorId, zoneId],
  );
  const result = useRemote(load);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") result.reload();
    };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [result.reload]);
  if (!result.value) return <RemoteStatus error={result.error} reload={result.reload} />;
  return (
    <div>
      <Recommendation
        {...result.value.recommendation}
        label={
          role === "admin" ? "FIF Ops Desk" : role === "vendor" ? "FIF · Shift priorities" : "FIF · Best pickup option"
        }
      />
      <p className="muted small">
        Demo recommendation · {result.value.source === "gemini" ? "Gemini ranking" : "Rules fallback"} · App activity
      </p>
    </div>
  );
}
