"use client";

import { useCallback, useEffect } from "react";
import { Recommendation } from "../shared";
import { RemoteStatus, useHostedData, useRemote } from "./common";

export function HostedFif({ role, vendorId, zoneId }: { role: "student" | "vendor" | "admin"; vendorId?: string; zoneId?: string }) {
  const api = useHostedData();
  const load = useCallback(() => api.recommendations({ role, vendorId: vendorId || undefined, zoneId: zoneId || undefined }), [api, role, vendorId, zoneId]);
  const result = useRemote(load);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") result.reload(); };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [result.reload]);
  if (!result.value) return <RemoteStatus error={result.error} reload={result.reload} />;
  return <div><Recommendation {...result.value.recommendation} label={role === "admin" ? "FIF Ops Desk" : role === "vendor" ? "FIF · Shift priorities" : "FIF · Best pickup option"} />
    <p className="muted small">FIF intelligence · {result.value.source === "gemini" ? "Gemini ranking" : "Smart rules"} · Live app activity</p></div>;
}
