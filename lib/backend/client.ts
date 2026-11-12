"use client";

import { z } from "zod";
import { scenarioInput, scenarioOutput } from "../fif-scenarios";
import {
  activityRow, adminReportOutput, auditRow, basketCheckoutInput, cartOutput, catalogueOutput, copilotExecuteOutput, copilotOutput, errorBody, fifOutput, menuRow, orderResult, orderRow, paymentOutput, pickupOutput, quoteOutput, sessionOutput, usersOutput, vendorPayment, vendorRow,
  type CheckoutInput, type CopilotHistoryTurn, type CopilotProposedAction, type QuoteInput,
} from "./contracts";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
const ok = z.object({ ok: z.literal(true) });
export const sessionInvalidated = "ap-food-session-invalidated";

async function request<T>(path: string, output: z.ZodType<T>, method = "GET", input?: unknown, userId?: string) {
  const form = input instanceof FormData;
  const response = await fetch("/api/" + path, {
    method, cache: "no-store", signal: AbortSignal.timeout(15_000),
    headers: { ...(input === undefined || form ? {} : { "Content-Type": "application/json" }), ...(userId ? { "X-AP-Food-User": userId } : {}) },
    ...(input === undefined ? {} : { body: form ? input : JSON.stringify(input) }),
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
  recommendations: (input: { role: "student" | "vendor" | "admin"; vendorId?: string; zoneId?: string }) => call("fif/recommendations", fifOutput, "POST", input),
  vendorScenarios: (input: z.infer<typeof scenarioInput>) => call("fif/vendor-scenarios", scenarioOutput, "POST", input),
  vendorCopilot: (input: { vendorId: string; message: string; history?: CopilotHistoryTurn[] }) =>
    call("fif/copilot", copilotOutput, "POST", input),
  executeVendorCopilot: (input: { vendorId: string; action: CopilotProposedAction }) =>
    call("fif/copilot/execute", copilotExecuteOutput, "POST", input),
  signIn: async (email: string, password: string) => {
    const session = await request("auth/session", sessionOutput, "POST", { email, password });
    window.dispatchEvent(new CustomEvent(sessionInvalidated, { detail: { session } }));
    return session;
  },
  register: (input: { email: string; password: string; displayName: string }) => request("auth/register", ok, "POST", input),
  resend: (email: string) => request("auth/resend", ok, "POST", { email }),
  recover: (email: string) => request("auth/recover", ok, "POST", { email }),
  updateProfile: (input: { displayName?: string; email?: string; password?: string; currentPassword?: string }) => call("auth/profile", ok, "POST", input),
  session: () => request("auth/session", sessionOutput),
  signOut: async () => {
    const response = await call("auth/session", ok, "DELETE");
    window.dispatchEvent(new CustomEvent(sessionInvalidated, { detail: { session: null } }));
    return response;
  },
  zones: () => request("zones", z.array(z.object({ id: z.string(), name: z.string() }))),
  vendors: () => request("vendors", z.array(vendorRow)),
  catalogue: () => request("catalogue", catalogueOutput),
  deals: () => request("deals", z.array(menuRow)),
  menu: (vendorId: string) => request("vendors/" + encodeURIComponent(vendorId) + "/menu", z.array(menuRow)),
  quote: (input: QuoteInput) => call("checkout/quote", quoteOutput, "POST", input),
  place: (input: CheckoutInput) => call("orders", orderResult, "POST", input),
  placeBasket: (input: z.infer<typeof basketCheckoutInput>) => call("checkout/basket", z.object({ orders: z.array(orderResult) }), "POST", input),
  cart: () => call("cart", cartOutput),
  saveCart: (input: { vendorId: string | null; items: QuoteInput["items"]; revision: number }) => call("cart", cartOutput, "PUT", input),
  vendorPayment: (vendorId: string) => request("vendors/" + encodeURIComponent(vendorId) + "/payment", vendorPayment.nullable()),
  uploadQr: (vendorId: string, data: FormData) => call("vendor/payments/" + encodeURIComponent(vendorId), ok, "POST", data),
  orderPayment: (id: string) => call("orders/" + encodeURIComponent(id) + "/payment", paymentOutput.nullable()),
  claimPayment: (id: string) => call("orders/" + encodeURIComponent(id) + "/payment-claim", ok, "POST"),
  refund: (id: string, reference: string) => call("orders/" + encodeURIComponent(id) + "/refund", ok, "POST", { reference }),
  users: (params: URLSearchParams) => call("admin/users?" + params, usersOutput),
  manageUser: (id: string, input: { status: "active" | "suspended"; memberships: { role: "student" | "vendor" | "admin"; vendor_id: string | null }[]; reason: string }) => call("admin/users/" + encodeURIComponent(id), ok, "PATCH", input),
  invite: (input: { email: string; displayName: string; role: "student" | "vendor" | "admin"; vendorId: string | null }) => call("admin/users/invite", ok, "POST", input),
  orders: () => call("orders", z.array(orderRow)),
  adminOrders: (params: URLSearchParams) => call("admin/orders?" + params, z.array(orderRow)),
  vendorReport: (vendorId: string, days: string) => call("vendor/report?" + new URLSearchParams({ vendorId, days }), adminReportOutput),
  order: (id: string) => call("orders/" + encodeURIComponent(id), orderRow),
  kitchen: (vendorId: string) => call("vendor/orders?vendorId=" + encodeURIComponent(vendorId), z.array(orderRow)),
  assignedStalls: () => call("vendor/stalls", z.array(vendorRow)),
  vendorMenu: (vendorId: string) => call("vendor/menu-items?vendorId=" + encodeURIComponent(vendorId), z.array(menuRow)),
  uploadMenuImage: (vendorId: string, data: FormData) => call("vendor/menu-images/" + encodeURIComponent(vendorId), z.object({ url: z.string() }), "POST", data),
  saveMenu: (input: { id: string; vendorId: string; name: string; description: string; priceSen: number; stock: number; expectedStock: number | null; active: boolean; workUnits?: number; image?: string }) =>
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
