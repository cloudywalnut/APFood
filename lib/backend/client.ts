"use client";

import { z } from "zod";
import {
  activityRow, adminReportOutput, auditRow, errorBody, menuRow, orderResult, orderRow, pickupOutput, quoteOutput, sessionOutput, vendorRow,
  type CheckoutInput, type QuoteInput,
} from "./contracts";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
const ok = z.object({ ok: z.literal(true) });
export const sessionInvalidated = "ap-food-session-invalidated";

async function request<T>(path: string, output: z.ZodType<T>, method = "GET", input?: unknown, userId?: string) {
  const response = await fetch("/api/" + path, {
    method, cache: "no-store", signal: AbortSignal.timeout(15_000),
    headers: { ...(input === undefined ? {} : { "Content-Type": "application/json" }), ...(userId ? { "X-AP-Food-User": userId } : {}) },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  }).catch(() => { throw new ApiError(0, "CONNECTION_LOST", "Could not confirm the server response. Retry the request."); });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = errorBody.safeParse(payload);
    if (userId && response.status === 401) window.dispatchEvent(new Event(sessionInvalidated));
    throw new ApiError(response.status, parsed.data?.error.code ?? "REQUEST_FAILED", parsed.data?.error.message ?? "The service could not complete this request.");
  }
  const parsed = output.safeParse(payload);
  if (!parsed.success) throw new ApiError(502, "INVALID_RESPONSE", "The server returned an unexpected response. Try again.");
  return parsed.data;
}

export function createHostedData(userId?: string) {
  const call = <T>(path: string, output: z.ZodType<T>, method?: string, input?: unknown) => request(path, output, method, input, userId);
  return {
  signIn: (email: string, password: string) => request("auth/session", sessionOutput, "POST", { email, password }),
  session: () => request("auth/session", sessionOutput),
  signOut: () => call("auth/session", ok, "DELETE"),
  zones: () => request("zones", z.array(z.object({ id: z.string(), name: z.string() }))),
  vendors: () => request("vendors", z.array(vendorRow)),
  menu: (vendorId: string) => request("vendors/" + encodeURIComponent(vendorId) + "/menu", z.array(menuRow)),
  quote: (input: QuoteInput) => call("checkout/quote", quoteOutput, "POST", input),
  place: (input: CheckoutInput) => call("orders", orderResult, "POST", input),
  orders: () => call("orders", z.array(orderRow)),
  order: (id: string) => call("orders/" + encodeURIComponent(id), orderRow),
  kitchen: (vendorId: string) => call("vendor/orders?vendorId=" + encodeURIComponent(vendorId), z.array(orderRow)),
  assignedStalls: () => call("vendor/stalls", z.array(vendorRow)),
  vendorMenu: (vendorId: string) => call("vendor/menu-items?vendorId=" + encodeURIComponent(vendorId), z.array(menuRow)),
  saveMenu: (input: { id: string; vendorId: string; name: string; description: string; priceSen: number; stock: number; expectedStock: number | null; active: boolean; workUnits: number }) =>
    call("vendor/menu-items", ok, "POST", input),
  settings: (vendorId: string, input: { capacity?: number; leadMinutes?: number; opensAt?: string; closesAt?: string; paused?: boolean }) =>
    call("vendor/capacity/" + encodeURIComponent(vendorId), ok, "PATCH", input),
  issuePickup: (id: string) => call("orders/" + encodeURIComponent(id) + "/pickup-token", pickupOutput, "POST"),
  cancel: (id: string, reason?: string) => call("orders/" + encodeURIComponent(id) + "/cancel", orderResult, "POST", { reason }),
  transition: (id: string, status: "accepted" | "preparing" | "ready" | "rejected", reason?: string) => call("vendor/orders/" + encodeURIComponent(id) + "/transition", orderResult, "POST", { status, reason }),
  collect: (id: string, code: string, counterConfirmed: boolean) => call("vendor/orders/" + encodeURIComponent(id) + "/collect", orderResult, "POST", { code, counterConfirmed }),
  traffic: () => request("traffic/zones", z.object({ source: z.literal("app_pickup_activity"), physicalCrowdVerified: z.literal(false), buckets: z.array(activityRow) })),
  report: (params: URLSearchParams) => call("admin/report?" + params.toString(), adminReportOutput),
  audit: () => call("admin/audit", z.array(auditRow)),
  manageStall: (id: string, input: { status: "approved" | "suspended"; zoneId: string; reason: string }) =>
    call("admin/vendors/" + encodeURIComponent(id), ok, "PATCH", input),
  expense: (input: { vendorId: string | null; amountSen: number; label: string; idempotencyKey: string }) =>
    call("admin/expenses", orderResult, "POST", input),
  reverseExpense: (id: string, reason: string) => call("admin/expenses/" + encodeURIComponent(id) + "/reverse", orderResult, "POST", { reason }),
  };
}

export const hostedData = createHostedData();
