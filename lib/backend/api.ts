import { z } from "zod";
import { BackendError, unwrap } from "./errors";
import { basketCheckoutInput, cartInput, checkoutInput, id, orderId, quoteInput } from "./contracts";
import { requestClient, type RequestClient } from "./supabase";
import { adminReport } from "./reports";
import { authAction, authLimit } from "./auth";
import { inviteAccount, manageAccount, qrUrl, uploadVendorQr } from "./account-actions";
import { clearRecovery } from "./recovery";
import { recommendations } from "./fif";
import { dayKey } from "../orders";

const orderFields =
  "id,vendor_id,zone_id,pickup_at,status,payment,lines,total_sen,version,created_at,updated_at,ready_at,collected_at,payment_record:order_payments(status)";
const vendorFields =
  "id,zone_id,name,description,category,image,status,paused,capacity,lead_minutes,opens_at,closes_at";
const menuFields = "id,vendor_id,name,description,price_sen,discount_sen,stock,active,work_units";
const transitionInput = z
  .object({ status: z.enum(["accepted", "preparing", "ready", "rejected"]), reason: z.string().max(250).optional() })
  .strict();
const cancellation = z.object({ reason: z.string().max(250).optional() }).strict();
const collection = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[a-fA-F0-9]{32}$/),
    counterConfirmed: z.boolean().default(false),
  })
  .strict();
const login = z.object({ email: z.email(), password: z.string().min(1).max(128) }).strict();
const hour = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/);
const settings = z
  .object({
    capacity: z.number().int().min(1).max(300).optional(),
    leadMinutes: z.number().int().min(1).max(120).optional(),
    opensAt: hour.optional(),
    closesAt: hour.optional(),
    paused: z.boolean().optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0);
const menu = z
  .object({
    id,
    vendorId: id,
    name: z.string().trim().min(1).max(70),
    description: z.string().max(140),
    priceSen: z.number().int().min(1).max(100_000),
    stock: z.number().int().min(0).max(1_000_000),
    expectedStock: z.number().int().min(0).nullable(),
    active: z.boolean(),
    workUnits: z.number().int().min(1).max(300),
  })
  .strict();
const management = z
  .object({
    status: z.enum(["approved", "suspended"]).optional(),
    zoneId: id.optional(),
    reason: z.string().trim().min(1).max(250),
  })
  .strict()
  .refine((input) => Boolean(input.status || input.zoneId));
const expense = z
  .object({
    vendorId: id.nullable(),
    amountSen: z.number().int().min(1).max(10_000_000),
    label: z.string().trim().min(1).max(150),
    idempotencyKey: z.uuid(),
  })
  .strict();
const reversal = z.object({ reason: z.string().trim().min(1).max(250) }).strict();

async function body<T>(request: Request, schema: z.ZodType<T>) {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new BackendError(400, "INVALID_INPUT", "Send a valid JSON request.");
  }
  return schema.parse(value);
}

async function session(client: RequestClient) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new BackendError(401, "UNAUTHENTICATED", "Sign in to continue.");
  const profile = unwrap(
    await client.from("profiles").select("id,display_name,status,created_at").eq("id", data.user.id).single(),
  );
  return {
    userId: data.user.id,
    email: data.user.email ?? "",
    emailVerified: Boolean(data.user.email_confirmed_at),
    profile,
    memberships: unwrap(await client.from("memberships").select("role,vendor_id").eq("user_id", data.user.id)),
  };
}

function requireMembership(
  actor: Awaited<ReturnType<typeof session>>,
  role: "student" | "vendor" | "admin",
  vendor?: string,
) {
  if (!actor.emailVerified) throw new BackendError(403, "EMAIL_UNCONFIRMED", "Confirm your email before continuing.");
  if (actor.profile?.status !== "active")
    throw new BackendError(403, "ACCOUNT_SUSPENDED", "Your account is suspended. Contact cafeteria support.");
  if (
    !actor.memberships?.some((entry) => entry.role === role && (vendor === undefined || entry.vendor_id === vendor))
  ) {
    throw new BackendError(403, "FORBIDDEN", "This action is unavailable for your account.");
  }
  return actor;
}

function result(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function handleRequest(request: Request, path: string[]) {
  const requestId = crypto.randomUUID();
  try {
    const key = path.join("/");
    const client = await requestClient(request);
    let verifiedSession: ReturnType<typeof session> | undefined;
    const getSession = () => (verifiedSession ??= session(client));
    const method = request.method;
    const expectedUser = request.headers.get("x-ap-food-user");
    if (expectedUser && (await getSession()).userId !== orderId.parse(expectedUser)) {
      throw new BackendError(
        401,
        "SESSION_CHANGED",
        "Your account changed. Sign in as the original account to continue.",
      );
    }
    const query = new URL(request.url).searchParams;
    if (method === "POST" && key === "fif/recommendations") {
      const input = await body(
        request,
        z
          .object({ role: z.enum(["student", "vendor", "admin"]), vendorId: id.optional(), zoneId: id.optional() })
          .strict(),
      );
      const actor = requireMembership(
        await getSession(),
        input.role,
        input.role === "vendor" ? input.vendorId : undefined,
      );
      if (input.role === "vendor" && !input.vendorId) throw new BackendError(400, "INVALID_INPUT", "Choose a stall.");
      return result(await recommendations(client, input, actor.userId));
    }
    if (
      method === "POST" &&
      path[0] === "auth" &&
      ["register", "resend", "recover", "profile"].includes(path[1]) &&
      path.length === 2
    ) {
      if (path[1] === "profile") await getSession();
      return result(await authAction(request, path[1], client));
    }
    if (key === "auth/session") {
      if (method === "POST") {
        await authLimit(request, "login");
        const input = await body(request, login);
        const auth = await client.auth.signInWithPassword(input);
        if (auth.error)
          throw new BackendError(
            401,
            auth.error.code === "email_not_confirmed" ? "EMAIL_UNCONFIRMED" : "INVALID_LOGIN",
            auth.error.code === "email_not_confirmed"
              ? "Confirm your email before signing in."
              : "Check the email and password.",
          );
        return result(await getSession());
      }
      if (method === "GET") return result(await getSession());
      if (method === "DELETE") {
        const { error } = await client.auth.signOut({ scope: "local" });
        if (error) throw new BackendError(401, "UNAUTHENTICATED", "Sign in to continue.");
        await clearRecovery();
        return result({ ok: true });
      }
    }
    if (method === "GET" && key === "zones")
      return result(unwrap(await client.from("zones").select("id,name").order("name")));
    if (method === "GET" && key === "catalogue") {
      const [vendors, items, zones] = await Promise.all([
        client.from("vendors").select(vendorFields).eq("status", "approved").order("name"),
        client
          .from("menu_items")
          .select(menuFields + ",vendors!inner()")
          .eq("vendors.status", "approved")
          .eq("active", true)
          .order("name"),
        client.from("zones").select("id,name").order("name"),
      ]);
      return result({ vendors: unwrap(vendors), items: unwrap(items), zones: unwrap(zones) });
    }
    if (method === "GET" && key === "vendors")
      return result(unwrap(await client.from("vendors").select(vendorFields).eq("status", "approved").order("name")));
    if (method === "GET" && key === "deals")
      return result(
        unwrap(
          await client
            .from("menu_items")
            .select(menuFields + ",vendors!inner()")
            .eq("vendors.status", "approved")
            .eq("active", true)
            .gt("discount_sen", 0)
            .gt("stock", 0)
            .order("name"),
        ),
      );
    if (method === "GET" && path.length === 3 && path[0] === "vendors" && path[2] === "menu") {
      const vendor = id.parse(path[1]);
      const rows = unwrap(
        await client
          .from("menu_items")
          .select(menuFields + ",vendors!inner()")
          .eq("vendor_id", vendor)
          .eq("vendors.status", "approved")
          .eq("active", true)
          .order("name"),
      );
      return result(rows);
    }
    if (method === "GET" && key === "traffic/zones") {
      return result({
        source: "app_pickup_activity",
        physicalCrowdVerified: false,
        buckets: unwrap(await client.rpc("pickup_activity")),
      });
    }
    if (method === "POST" && key === "checkout/quote") {
      const input = await body(request, quoteInput);
      const quote = unwrap(await client.rpc("quote_checkout", { p_vendor: input.vendorId, p_cart: input.items }));
      if (input.payment === "duitnow_qr") {
        const vendor = unwrap(await client.from("vendors").select("lead_minutes").eq("id", input.vendorId).single());
        if (!vendor) throw new BackendError(404, "STALL_UNAVAILABLE", "Stall unavailable.");
        quote.slots = quote.slots.filter(
          (slot: string) => Date.parse(slot) >= Date.now() + (vendor.lead_minutes + 5) * 60_000,
        );
      }
      return result(quote);
    }
    if (method === "POST" && key === "orders") {
      const input = await body(request, checkoutInput);
      return result(
        unwrap(
          await client.rpc(input.cartRevision === undefined ? "place_order" : "checkout_cart", {
            p_quote: input.quoteId,
            p_pickup: input.pickupAt,
            p_payment: input.payment,
            p_key: input.idempotencyKey,
            ...(input.cartRevision === undefined ? {} : { p_revision: input.cartRevision }),
          }),
        ),
        201,
      );
    }
    if (method === "POST" && key === "checkout/basket") {
      requireMembership(await getSession(), "student");
      const input = await body(request, basketCheckoutInput);
      return result(
        unwrap(
          await client.rpc("checkout_basket", {
            p_orders: input.orders,
            p_key: input.idempotencyKey,
            p_revision: input.cartRevision,
          }),
        ),
        201,
      );
    }
    if (key === "cart") {
      const actor = requireMembership(await getSession(), "student");
      if (method === "GET")
        return result(
          unwrap(
            await client.from("carts").select("vendor_id,items,revision").eq("user_id", actor.userId).maybeSingle(),
          ) ?? { vendor_id: null, items: [], revision: 0 },
        );
      if (method === "PUT") {
        const input = await body(request, cartInput);
        return result(
          unwrap(
            await client.rpc("save_cart", {
              p_vendor: input.vendorId,
              p_items: input.items,
              p_revision: input.revision,
            }),
          ),
        );
      }
    }
    if (key === "admin/users" && method === "GET") {
      requireMembership(await getSession(), "admin");
      return result(
        unwrap(
          await client.rpc("list_accounts", {
            p_search: z
              .string()
              .max(100)
              .parse(query.get("search") ?? ""),
            p_role: z.enum(["", "student", "vendor", "admin"]).parse(query.get("role") ?? ""),
            p_status: z.enum(["", "active", "suspended"]).parse(query.get("status") ?? ""),
            p_page: z.coerce
              .number()
              .int()
              .min(1)
              .max(10000)
              .parse(query.get("page") ?? 1),
          }),
        ),
      );
    }
    if (key === "admin/users/invite" && method === "POST") {
      requireMembership(await getSession(), "admin");
      return result(await inviteAccount(request, client), 201);
    }
    if (path[0] === "admin" && path[1] === "users" && path.length === 3 && method === "PATCH") {
      requireMembership(await getSession(), "admin");
      return result(await manageAccount(request, client, path[2]));
    }
    if (path[0] === "vendors" && path.length === 3 && path[2] === "payment" && method === "GET") {
      const details = unwrap(
        await client.from("vendor_payments").select("*").eq("vendor_id", id.parse(path[1])).maybeSingle(),
      );
      return result(details ? { ...details, qrUrl: qrUrl(client, details.qr_path) } : null);
    }
    if (path[0] === "vendor" && path[1] === "payments" && path.length === 3 && method === "POST") {
      const vendor = id.parse(path[2]);
      requireMembership(await getSession(), "vendor", vendor);
      return result(await uploadVendorQr(request, client, vendor));
    }
    if (method === "GET" && key === "orders") {
      const actor = requireMembership(await getSession(), "student");
      return result(
        unwrap(
          await client
            .from("orders")
            .select(orderFields)
            .eq("student_id", actor.userId)
            .order("created_at", { ascending: false })
            .limit(100),
        ),
      );
    }
    if (method === "GET" && path[0] === "orders" && path.length === 2) {
      await getSession();
      const order = unwrap(
        await client.from("orders").select(orderFields).eq("id", orderId.parse(path[1])).maybeSingle(),
      );
      if (!order) throw new BackendError(404, "ORDER_NOT_FOUND", "Order unavailable.");
      return result(order);
    }
    if (method === "POST" && path[0] === "orders" && path.length === 3) {
      const order = orderId.parse(path[1]);
      if (path[2] === "payment-claim") {
        unwrap(await client.rpc("claim_qr_payment", { p_id: order }));
        return result({ ok: true });
      }
      if (path[2] === "pickup-token") return result(unwrap(await client.rpc("issue_pickup_code", { p_id: order })));
      if (path[2] === "cancel") {
        const input = await body(request, cancellation);
        return result(
          unwrap(
            await client.rpc("transition_order", {
              p_id: order,
              p_status: "cancelled",
              p_reason: input.reason ?? null,
            }),
          ),
        );
      }
    }
    if (method === "GET" && path[0] === "orders" && path.length === 3 && path[2] === "payment") {
      await getSession();
      const details = unwrap(
        await client
          .from("order_payments")
          .select("order_id,status,expires_at,paid_at,merchant_name,qr_path,refund_reference,refunded_at")
          .eq("order_id", orderId.parse(path[1]))
          .maybeSingle(),
      );
      return result(details ? { ...details, qrUrl: qrUrl(client, details.qr_path) } : null);
    }
    if (method === "POST" && path[0] === "orders" && path.length === 3 && path[2] === "refund") {
      const input = await body(request, z.object({ reference: z.string().trim().min(1).max(120) }).strict());
      unwrap(await client.rpc("record_refund", { p_id: orderId.parse(path[1]), p_reference: input.reference }));
      return result({ ok: true });
    }
    if (method === "GET" && key === "vendor/orders") {
      const vendor = id.parse(query.get("vendorId"));
      requireMembership(await getSession(), "vendor", vendor);
      return result(
        unwrap(
          await client
            .from("orders")
            .select(orderFields)
            .eq("vendor_id", vendor)
            .order("created_at", { ascending: false })
            .limit(100),
        ),
      );
    }
    if (method === "GET" && key === "vendor/stalls") {
      const actor = requireMembership(await getSession(), "vendor");
      const ids = (actor.memberships ?? []).flatMap((entry) =>
        entry.role === "vendor" && entry.vendor_id ? [entry.vendor_id] : [],
      );
      return result(
        ids.length ? unwrap(await client.from("vendors").select(vendorFields).in("id", ids).order("name")) : [],
      );
    }
    if (method === "POST" && path.length === 4 && path[0] === "vendor" && path[1] === "orders") {
      const order = orderId.parse(path[2]);
      if (path[3] === "transition") {
        const input = await body(request, transitionInput);
        return result(
          unwrap(
            await client.rpc("transition_order", {
              p_id: order,
              p_status: input.status,
              p_reason: input.reason ?? null,
            }),
          ),
        );
      }
      if (path[3] === "collect") {
        const input = await body(request, collection);
        return result(
          unwrap(
            await client.rpc("collect_order", {
              p_id: order,
              p_code: input.code,
              p_counter_confirmed: input.counterConfirmed,
            }),
          ),
        );
      }
    }
    if (method === "PATCH" && path.length === 3 && path[0] === "vendor" && path[1] === "capacity") {
      const input = await body(request, settings);
      unwrap(
        await client.rpc("update_vendor_settings", {
          p_id: id.parse(path[2]),
          p_capacity: input.capacity ?? null,
          p_lead: input.leadMinutes ?? null,
          p_opens: input.opensAt ?? null,
          p_closes: input.closesAt ?? null,
          p_paused: input.paused ?? null,
        }),
      );
      return result({ ok: true });
    }
    if (method === "GET" && key === "vendor/menu-items") {
      const vendor = id.parse(query.get("vendorId"));
      requireMembership(await getSession(), "vendor", vendor);
      return result(unwrap(await client.from("menu_items").select(menuFields).eq("vendor_id", vendor).order("name")));
    }
    if (method === "POST" && key === "vendor/menu-items") {
      const input = await body(request, menu);
      unwrap(
        await client.rpc("save_menu_item", {
          p_vendor: input.vendorId,
          p_id: input.id,
          p_name: input.name,
          p_description: input.description,
          p_price: input.priceSen,
          p_stock: input.stock,
          p_active: input.active,
          p_units: input.workUnits,
          p_expected_stock: input.expectedStock,
        }),
      );
      return result({ ok: true });
    }
    if (method === "PATCH" && path.length === 3 && path[0] === "admin" && path[1] === "vendors") {
      const input = await body(request, management);
      unwrap(
        await client.rpc("admin_manage_vendor", {
          p_id: id.parse(path[2]),
          p_status: input.status ?? null,
          p_zone: input.zoneId ?? null,
          p_reason: input.reason,
        }),
      );
      return result({ ok: true });
    }
    if (method === "POST" && key === "admin/expenses") {
      const input = await body(request, expense);
      return result(
        {
          id: unwrap(
            await client.rpc("record_expense", {
              p_vendor: input.vendorId,
              p_amount: input.amountSen,
              p_label: input.label,
              p_key: input.idempotencyKey,
            }),
          ),
        },
        201,
      );
    }
    if (
      method === "POST" &&
      path.length === 4 &&
      path[0] === "admin" &&
      path[1] === "expenses" &&
      path[3] === "reverse"
    ) {
      const input = await body(request, reversal);
      return result(
        {
          id: unwrap(await client.rpc("reverse_expense", { p_entry: orderId.parse(path[2]), p_reason: input.reason })),
        },
        201,
      );
    }
    if (method === "GET" && key === "admin/report") {
      requireMembership(await getSession(), "admin");
      return result(await adminReport(client, query));
    }
    if (method === "GET" && key === "vendor/report") {
      const vendor = id.parse(query.get("vendorId"));
      requireMembership(await getSession(), "vendor", vendor);
      return result(
        await adminReport(client, new URLSearchParams({ vendorId: vendor, days: query.get("days") ?? "7" })),
      );
    }
    if (method === "GET" && key === "admin/orders") {
      requireMembership(await getSession(), "admin");
      const days = z.coerce
        .number()
        .int()
        .min(1)
        .max(14)
        .parse(query.get("days") ?? 7);
      let rows = client
        .from("orders")
        .select(orderFields, { count: "exact" })
        .gte("created_at", new Date(dayKey(1 - days) + "T00:00:00+08:00").toISOString())
        .order("created_at", { ascending: false });
      if (query.get("vendorId")) rows = rows.eq("vendor_id", id.parse(query.get("vendorId")));
      if (query.get("zoneId")) rows = rows.eq("zone_id", id.parse(query.get("zoneId")));
      const response = await rows;
      const orders = unwrap(response) ?? [];
      if ((response.count ?? 0) > orders.length)
        throw new BackendError(400, "REPORT_RANGE_TOO_LARGE", "Filter by stall or choose a shorter period.");
      return result(orders);
    }
    if (method === "GET" && key === "admin/audit") {
      requireMembership(await getSession(), "admin");
      return result(
        unwrap(
          await client
            .from("audit_events")
            .select("id,actor_role,action,target,reason,created_at")
            .order("created_at", { ascending: false })
            .limit(100),
        ),
      );
    }
    throw new BackendError(404, "NOT_FOUND", "Endpoint unavailable.");
  } catch (error) {
    const failure =
      error instanceof BackendError
        ? error
        : error instanceof z.ZodError
          ? new BackendError(400, "INVALID_INPUT", "Review the request fields.")
          : new BackendError(500, "INTERNAL_ERROR", "The service could not complete this request.");
    if (failure.status === 500) console.error("AP Food API failure", { requestId, path: path[0], code: failure.code });
    return result({ error: { code: failure.code, message: failure.message, requestId } }, failure.status);
  }
}
