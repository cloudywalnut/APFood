"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApi, useSessionUser } from "../workspace/common";
import { adminScope, type AdminOverview } from "../../lib/admin-dashboard";
const pending = new Map<string, Promise<AdminOverview>>();
export function useAdminScope() {
  const params = useSearchParams();
  return adminScope.parse({
    days: ["1", "7", "14", "30", "90"].includes(params.get("days") ?? "") ? params.get("days") : "7",
    vendorId: /^[a-z0-9][a-z0-9-]{0,95}$/.test(params.get("vendorId") ?? "") ? params.get("vendorId")! : undefined,
    zoneId: /^[a-z0-9][a-z0-9-]{0,95}$/.test(params.get("zoneId") ?? "") ? params.get("zoneId")! : undefined,
  });
}
export function useAdminOverview() {
  const userId = useSessionUser();
  const api = useApi(),
    scope = useAdminScope(),
    key = JSON.stringify(scope);
  const [state, setState] = useState<{ key: string; value?: AdminOverview; error?: unknown; busy: boolean }>({
    key,
    busy: true,
  });
  const [revision, setRevision] = useState(0),
    generation = useRef(0);
  const reload = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    const version = ++generation.current;
    setState((old) => (old.key === key ? { ...old, busy: true, error: undefined } : { key, busy: true }));
    const requestKey = userId + ":" + key;
    let request = pending.get(requestKey);
    if (!request) {
      request = api.adminOverview(JSON.parse(key));
      pending.set(requestKey, request);
      void request.then(
        () => pending.delete(requestKey),
        () => pending.delete(requestKey),
      );
    }
    void request.then(
      (value) => {
        if (version === generation.current) setState({ key, value, busy: false });
      },
      (error) => {
        if (version === generation.current) setState((old) => ({ ...old, error, busy: false }));
      },
    );
    return () => {
      generation.current++;
    };
  }, [api, userId, key, revision]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") reload();
    };
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [reload]);
  return { ...(state.key === key ? state : { key, busy: true }), scope, reload };
}
export const adminDate = (value: string) =>
  new Date(value).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur", dateStyle: "medium", timeStyle: "short" });
export function periodLabel(data: AdminOverview) {
  return `${new Date(data.since).toLocaleDateString("en-MY", { timeZone: "Asia/Kuala_Lumpur", day: "numeric", month: "short" })}–${new Date(data.asOf).toLocaleDateString("en-MY", { timeZone: "Asia/Kuala_Lumpur", day: "numeric", month: "short", year: "numeric" })}`;
}
