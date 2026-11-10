import { z } from "zod";

export const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,95}$/);
export const orderId = z.uuid();
export const payment = z.enum(["demo", "counter"]);
export const cartLine = z.object({ itemId: id, quantity: z.number().int().min(1).max(20), extra: z.boolean() }).strict();
export const quoteInput = z.object({ vendorId: id, items: z.array(cartLine).min(1).max(20) }).strict();
export const checkoutInput = z.object({ quoteId: z.uuid(), pickupAt: z.iso.datetime({ offset: true }), payment, idempotencyKey: z.uuid() }).strict();
export const orderLine = cartLine.extend({ name: z.string(), unit: z.number().int(), work: z.number().int() });
export const quoteOutput = z.object({ quoteId: z.uuid(), expiresAt: z.string(), totalSen: z.number().int(), slots: z.array(z.string()), lines: z.array(orderLine) });
export const pickupOutput = z.object({ code: z.string(), expiresAt: z.string() });
export const orderResult = z.object({ id: z.uuid() });
export const status = z.enum(["placed", "accepted", "preparing", "ready", "collected", "cancelled", "rejected"]);
export const orderRow = z.object({
  id: z.uuid(), vendor_id: id, zone_id: id, pickup_at: z.string(), status, payment, lines: z.array(orderLine),
  total_sen: z.number().int(), version: z.number().int(), created_at: z.string(), updated_at: z.string(),
  ready_at: z.string().nullable(), collected_at: z.string().nullable(),
});
export const vendorRow = z.object({
  id, zone_id: id, name: z.string(), description: z.string(), category: z.string(), image: z.string(),
  status: z.enum(["approved", "suspended"]), paused: z.boolean(), capacity: z.number().int(),
  lead_minutes: z.number().int(), opens_at: z.string(), closes_at: z.string(),
});
export const menuRow = z.object({
  id, vendor_id: id, name: z.string(), description: z.string(), price_sen: z.number().int(),
  discount_sen: z.number().int(), stock: z.number().int(), active: z.boolean(), work_units: z.number().int(),
});
export const membership = z.object({ role: z.enum(["student","vendor","admin"]), vendor_id: id.nullable() });
export const sessionOutput = z.object({ userId: z.uuid(), memberships: z.array(membership) });
export const activityRow = z.object({
  vendor_id: id, starts_at: z.string(), pickup_count: z.number().int(),
  reserved_units: z.number().int(), total_units: z.number().int(),
});
export const errorBody = z.object({ error: z.object({ code: z.string(), message: z.string(), requestId: z.string() }) });
export type QuoteInput = z.infer<typeof quoteInput>;
export type CheckoutInput = z.infer<typeof checkoutInput>;
export type OrderRow = z.infer<typeof orderRow>;
