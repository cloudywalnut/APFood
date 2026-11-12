import { z } from "zod";

export const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,95}$/);
export function isValidImageSrc(value: string) {
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}
export const fifOutput = z.object({
  recommendation: z.object({
    id: z.string(),
    title: z.string(),
    evidence: z.string(),
    href: z.string(),
    action: z.string(),
  }),
  source: z.enum(["rules", "gemini"]),
  generatedAt: z.string(),
  dataSource: z.literal("demo"),
});
export const orderId = z.uuid();
export const payment = z.enum(["demo", "counter", "duitnow_qr"]);
export const cartLine = z
  .object({ itemId: id, quantity: z.number().int().min(1).max(20), extra: z.boolean() })
  .strict();
export const basketLine = cartLine.extend({ vendorId: id.optional() });
export const quoteInput = z
  .object({ vendorId: id, items: z.array(cartLine).min(1).max(20), payment: payment.optional() })
  .strict();
export const checkoutInput = z
  .object({
    quoteId: z.uuid(),
    pickupAt: z.iso.datetime({ offset: true }),
    payment,
    idempotencyKey: z.uuid(),
    cartRevision: z.number().int().nonnegative().optional(),
  })
  .strict();
export const basketCheckoutInput = z
  .object({
    orders: z
      .array(checkoutInput.omit({ cartRevision: true }).extend({ vendorId: id }))
      .min(1)
      .max(10),
    idempotencyKey: z.uuid(),
    cartRevision: z.number().int().nonnegative(),
  })
  .strict();
export const orderLine = cartLine.extend({ name: z.string(), unit: z.number().int(), work: z.number().int() });
export const quoteOutput = z.object({
  quoteId: z.uuid(),
  expiresAt: z.string(),
  totalSen: z.number().int(),
  slots: z.array(z.string()),
  lines: z.array(orderLine),
});
export const pickupOutput = z.object({ code: z.string(), expiresAt: z.string() });
export const orderResult = z.object({ id: z.uuid() });
export const status = z.enum(["placed", "accepted", "preparing", "ready", "collected", "cancelled", "rejected"]);
export const orderRow = z.object({
  id: z.uuid(),
  vendor_id: id,
  zone_id: id,
  pickup_at: z.string(),
  status,
  payment,
  lines: z.array(orderLine),
  total_sen: z.number().int(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
  ready_at: z.string().nullable(),
  collected_at: z.string().nullable(),
  payment_record: z
    .object({ status: z.enum(["pending", "paid", "expired", "refund_pending", "refunded"]) })
    .nullable()
    .optional(),
});
export const vendorRow = z.object({
  id,
  zone_id: id,
  name: z.string(),
  description: z.string(),
  category: z.string(),
  image: z.string(),
  status: z.enum(["approved", "suspended"]),
  paused: z.boolean(),
  capacity: z.number().int(),
  lead_minutes: z.number().int(),
  opens_at: z.string(),
  closes_at: z.string(),
});
export const menuRow = z.object({
  id,
  vendor_id: id,
  name: z.string(),
  description: z.string(),
  price_sen: z.number().int(),
  discount_sen: z.number().int(),
  stock: z.number().int(),
  active: z.boolean(),
  work_units: z.number().int(),
  image: z.string().optional().default(""),
});
export const catalogueOutput = z.object({
  vendors: z.array(vendorRow),
  items: z.array(menuRow),
  zones: z.array(z.object({ id, name: z.string() })),
});
export const membership = z.object({ role: z.enum(["student", "vendor", "admin"]), vendor_id: id.nullable() });
export const profileRow = z.object({
  id: z.uuid(),
  display_name: z.string(),
  status: z.enum(["active", "suspended"]),
  created_at: z.string(),
});
export const sessionOutput = z.object({
  userId: z.uuid(),
  memberships: z.array(membership),
  email: z.string(),
  emailVerified: z.boolean(),
  profile: profileRow,
});
export const cartOutput = z.object({
  vendor_id: id.nullable(),
  items: z.array(basketLine),
  revision: z.number().int().nonnegative(),
});
export const cartInput = z
  .object({ vendorId: id.nullable(), items: z.array(basketLine).max(20), revision: z.number().int().nonnegative() })
  .strict();
export const studentCartAction = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  expiresAt: z.iso.datetime(),
  description: z.string().max(2000),
  issues: z.array(z.string().max(200)).max(20),
  added: z
    .array(
      z.object({
        itemId: id,
        name: z.string().max(100),
        quantity: z.number().int().min(1).max(20),
        unitPriceSen: z.number().int().nonnegative(),
      }),
    )
    .min(1)
    .max(20),
  cart: cartInput,
});
export type StudentCartAction = z.infer<typeof studentCartAction>;
export const studentFifChatOutput = z.object({
  reply: z.string(),
  ok: z.boolean(),
  cartAction: studentCartAction.optional(),
  links: z
    .array(
      z.object({ href: z.string().regex(/^\/(?:app(?:\/[A-Za-z0-9-]+)*|account|privacy|terms)$/), label: z.string() }),
    )
    .default([]),
});
export const userRow = profileRow.extend({
  email: z.string(),
  email_confirmed_at: z.string().nullable(),
  memberships: z.array(membership),
});
export const usersOutput = z.object({ total: z.number().int(), users: z.array(userRow) });
export const vendorPayment = z.object({
  vendor_id: id,
  merchant_name: z.string(),
  qr_path: z.string(),
  qrUrl: z.string().optional(),
});
export const paymentOutput = z.object({
  order_id: z.uuid(),
  status: z.enum(["pending", "paid", "expired", "refund_pending", "refunded"]),
  expires_at: z.string().nullable(),
  paid_at: z.string().nullable(),
  merchant_name: z.string().nullable(),
  qr_path: z.string().nullable(),
  qrUrl: z.string().nullable(),
  refund_reference: z.string().nullable(),
  refunded_at: z.string().nullable(),
});
export const activityRow = z.object({
  vendor_id: id,
  starts_at: z.string(),
  pickup_count: z.number().int(),
  reserved_units: z.number().int(),
  total_units: z.number().int(),
});
export const errorBody = z.object({
  error: z.object({ code: z.string(), message: z.string(), requestId: z.string() }),
});
const financeTotals = z.object({
  demo: z.number().int(),
  counter: z.number().int(),
  duitnow_qr: z.number().int(),
  refund: z.number().int(),
  expense: z.number().int(),
  reversal: z.number().int(),
  netSen: z.number().int(),
});
export const ledgerRow = z.object({
  id: z.uuid(),
  vendor_id: id.nullable(),
  zone_id: id.nullable(),
  order_id: z.uuid().nullable(),
  kind: z.enum(["demo", "counter", "duitnow_qr", "refund", "expense", "reversal"]),
  amount_sen: z.number().int(),
  label: z.string(),
  reverses_id: z.uuid().nullable(),
  created_at: z.string(),
});
export const adminReportOutput = z.object({
  asOf: z.string(),
  since: z.string(),
  source: z.enum(["standard_demo", "demo"]),
  analytics: z
    .object({
      daily: z.array(z.object({ day: z.string(), count: z.number().int().nonnegative() })),
      statuses: z.array(z.object({ status: z.string(), count: z.number().int().nonnegative() })),
      hours: z.array(z.object({ hour: z.number().int().min(0).max(23), count: z.number().int().nonnegative() })),
    })
    .optional(),
  finance: financeTotals.extend({
    orderedValueSen: z.number().int(),
    outstandingCounterSen: z.number().int(),
    sharedOverheadSen: z.number().int(),
  }),
  ledger: z.array(ledgerRow),
  products: z.array(
    menuRow
      .pick({ id: true, vendor_id: true, name: true, stock: true, active: true })
      .extend({ units: z.number().int(), fulfilledValueSen: z.number().int() }),
  ),
  vendors: z.array(
    vendorRow.pick({ id: true, zone_id: true, name: true, capacity: true, status: true, paused: true }).extend({
      ...financeTotals.shape,
      orderCount: z.number().int(),
      activeCount: z.number().int(),
      lateCount: z.number().int(),
    }),
  ),
});
export const auditRow = z.object({
  id: z.uuid(),
  actor_role: z.enum(["student", "vendor", "admin"]),
  action: z.string(),
  target: z.string(),
  reason: z.string().nullable(),
  created_at: z.string(),
});
export type QuoteInput = z.infer<typeof quoteInput>;
export type CheckoutInput = z.infer<typeof checkoutInput>;
export type OrderRow = z.infer<typeof orderRow>;

export const copilotHistoryTurn = z
  .object({
    role: z.enum(["user", "assistant"]),
    text: z.string().trim().min(1).max(600),
  })
  .strict();

export const copilotInput = z
  .object({
    vendorId: id,
    message: z.string().trim().min(1).max(400),
    history: z.array(copilotHistoryTurn).max(10).optional(),
  })
  .strict();

export const copilotMenuChanges = z
  .object({
    stock: z.number().int().min(0).max(5000).optional(),
    priceSen: z.number().int().min(50).max(50000).optional(),
    discountSen: z.number().int().min(0).max(49950).optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0);

export const copilotStallChanges = z
  .object({
    paused: z.boolean().optional(),
    capacity: z.number().int().min(1).max(300).optional(),
    leadMinutes: z.number().int().min(1).max(120).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0);

export const copilotProposedAction = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("update_menu_item"),
      summary: z.string().trim().min(1).max(200),
      itemId: id,
      itemName: z.string().trim().min(1).max(80),
      expectedStock: z.number().int().min(0).max(1_000_000),
      before: z
        .object({
          stock: z.number().int(),
          priceSen: z.number().int(),
          discountSen: z.number().int(),
          active: z.boolean(),
        })
        .strict(),
      changes: copilotMenuChanges,
    })
    .strict(),
  z
    .object({
      type: z.literal("update_stall_settings"),
      summary: z.string().trim().min(1).max(200),
      before: z
        .object({
          paused: z.boolean(),
          capacity: z.number().int(),
          leadMinutes: z.number().int(),
        })
        .strict(),
      changes: copilotStallChanges,
    })
    .strict(),
]);

export const copilotOutput = z.object({
  reply: z.string(),
  source: z.enum(["gemini", "rules"]),
  proposedAction: copilotProposedAction.nullable(),
  generatedAt: z.string(),
});

export const copilotExecuteInput = z
  .object({
    vendorId: id,
    action: copilotProposedAction,
  })
  .strict();

export const copilotExecuteOutput = z.object({
  ok: z.literal(true),
  appliedSummary: z.string(),
});

export type CopilotHistoryTurn = z.infer<typeof copilotHistoryTurn>;
export type CopilotProposedAction = z.infer<typeof copilotProposedAction>;
export type CopilotOutput = z.infer<typeof copilotOutput>;
export type CopilotExecuteInput = z.infer<typeof copilotExecuteInput>;
