"use client";

import { z } from "zod";
import {
  activityRow, errorBody, menuRow, orderResult, orderRow, pickupOutput, quoteOutput, sessionOutput, vendorRow,
  type CheckoutInput, type QuoteInput,
} from "./contracts";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

async function request<T>(path: string, output: z.ZodType<T>, method = "GET", input?: unknown) {
  const response = await fetch("/api/" + path, {
    method, cache: "no-store",
    ...(input === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const parsed = errorBody.safeParse(payload);
    throw new ApiError(response.status, parsed.data?.error.code ?? "REQUEST_FAILED", parsed.data?.error.message ?? "The service could not complete this request.");
  }
  return output.parse(payload);
}

export const hostedData = {
  signIn: (email: string, password: string) => request("auth/session", sessionOutput, "POST", { email, password }),
  session: () => request("auth/session", sessionOutput),
  signOut: () => request("auth/session", z.object({ ok: z.literal(true) }), "DELETE"),
  zones: () => request("zones", z.array(z.object({ id: z.string(), name: z.string() }))),
  vendors: () => request("vendors", z.array(vendorRow)),
  menu: (vendorId: string) => request("vendors/" + encodeURIComponent(vendorId) + "/menu", z.array(menuRow)),
  quote: (input: QuoteInput) => request("checkout/quote", quoteOutput, "POST", input),
  place: (input: CheckoutInput) => request("orders", orderResult, "POST", input),
  orders: () => request("orders", z.array(orderRow)),
  order: (id: string) => request("orders/" + encodeURIComponent(id), orderRow),
  kitchen: (vendorId: string) => request("vendor/orders?vendorId=" + encodeURIComponent(vendorId), z.array(orderRow)),
  issuePickup: (id: string) => request("orders/" + encodeURIComponent(id) + "/pickup-token", pickupOutput, "POST"),
  cancel: (id: string, reason?: string) => request("orders/" + encodeURIComponent(id) + "/cancel", orderResult, "POST", { reason }),
  transition: (id: string, status: "accepted" | "preparing" | "ready" | "rejected", reason?: string) => request("vendor/orders/" + encodeURIComponent(id) + "/transition", orderResult, "POST", { status, reason }),
  collect: (id: string, code: string, counterConfirmed: boolean) => request("vendor/orders/" + encodeURIComponent(id) + "/collect", orderResult, "POST", { code, counterConfirmed }),
  traffic: () => request("traffic/zones", z.object({ source: z.literal("app_pickup_activity"), physicalCrowdVerified: z.literal(false), buckets: z.array(activityRow) })),
};
