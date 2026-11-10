import { z } from "zod";
import { BackendError, unwrap } from "./errors";
import { checkoutInput, id, orderId, quoteInput } from "./contracts";
import { requestClient, type RequestClient } from "./supabase";
import { adminReport } from "./reports";

const orderFields = "id,vendor_id,zone_id,pickup_at,status,payment,lines,total_sen,version,created_at,updated_at,ready_at,collected_at";
const vendorFields = "id,zone_id,name,description,category,image,status,paused,capacity,lead_minutes,opens_at,closes_at";
const menuFields = "id,vendor_id,name,description,price_sen,discount_sen,stock,active,work_units";
const transitionInput = z.object({ status: z.enum(["accepted","preparing","ready","rejected"]), reason: z.string().max(250).optional() }).strict();
const cancellation = z.object({ reason: z.string().max(250).optional() }).strict();
const collection = z.object({ code: z.string().trim().regex(/^[a-fA-F0-9]{32}$/), counterConfirmed: z.boolean().default(false) }).strict();
const login = z.object({ email: z.email(), password: z.string().min(1).max(128) }).strict();
const hour = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/);
const settings = z.object({ capacity: z.number().int().min(1).max(300).optional(), leadMinutes: z.number().int().min(1).max(120).optional(),
  opensAt: hour.optional(), closesAt: hour.optional(), paused: z.boolean().optional() }).strict().refine(input => Object.keys(input).length > 0);
const menu = z.object({ id, vendorId: id, name: z.string().trim().min(1).max(70), description: z.string().max(140), priceSen: z.number().int().min(1).max(100_000),
  stock: z.number().int().min(0).max(1_000_000), expectedStock: z.number().int().min(0).nullable(), active: z.boolean(), workUnits: z.number().int().min(1).max(300) }).strict();
const management = z.object({ status: z.enum(["approved","suspended"]).optional(), zoneId: id.optional(), reason: z.string().trim().min(1).max(250) }).strict()
  .refine(input => Boolean(input.status || input.zoneId));
const expense = z.object({ vendorId: id.nullable(), amountSen: z.number().int().min(1).max(10_000_000), label: z.string().trim().min(1).max(150), idempotencyKey: z.uuid() }).strict();
const reversal = z.object({ reason: z.string().trim().min(1).max(250) }).strict();

async function body<T>(request: Request, schema: z.ZodType<T>) {
  let value: unknown;
  try { value = await request.json(); } catch { throw new BackendError(400, "INVALID_INPUT", "Send a valid JSON request."); }
  return schema.parse(value);
}

async function session(client: RequestClient) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new BackendError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return { userId: data.user.id, memberships: unwrap(await client.from("memberships").select("role,vendor_id").eq("user_id", data.user.id)) };
}

export async function requireMembership(client: RequestClient, role: "student" | "vendor" | "admin", vendor?: string) {
  const actor = await session(client);
  if (!actor.memberships?.some(entry => entry.role === role && (vendor === undefined || entry.vendor_id === vendor))) {
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
    const method = request.method;
    const query = new URL(request.url).searchParams;
    if (key === "auth/session") {
      if (method === "POST") {
        const input = await body(request, login);
        const auth = await client.auth.signInWithPassword(input);
        if (auth.error) throw new BackendError(401, "INVALID_LOGIN", "Check the email and password.");
        return result(await session(client));
      }
      if (method === "GET") return result(await session(client));
      if (method === "DELETE") {
        const { error } = await client.auth.signOut({ scope: "local" });
        if (error) throw new BackendError(401, "UNAUTHENTICATED", "Sign in to continue.");
        return result({ ok: true });
      }
    }
    if (method === "GET" && key === "zones") return result(unwrap(await client.from("zones").select("id,name").order("name")));
    if (method === "GET" && key === "vendors") return result(unwrap(await client.from("vendors").select(vendorFields).eq("status", "approved").order("name")));
    if (method === "GET" && path.length === 3 && path[0] === "vendors" && path[2] === "menu") {
      const vendor = id.parse(path[1]);
      const rows = unwrap(await client.from("menu_items").select(menuFields + ",vendors!inner()").eq("vendor_id", vendor)
        .eq("vendors.status", "approved").eq("active", true).order("name"));
      return result(rows);
    }
    if (method === "GET" && key === "traffic/zones") {
      return result({ source: "app_pickup_activity", physicalCrowdVerified: false, buckets: unwrap(await client.rpc("pickup_activity")) });
    }
    if (method === "POST" && key === "checkout/quote") {
      const input = await body(request, quoteInput);
      return result(unwrap(await client.rpc("quote_checkout", { p_vendor: input.vendorId, p_cart: input.items })));
    }
    if (method === "POST" && key === "orders") {
      const input = await body(request, checkoutInput);
      return result(unwrap(await client.rpc("place_order", { p_quote: input.quoteId, p_pickup: input.pickupAt, p_payment: input.payment, p_key: input.idempotencyKey })), 201);
    }
    if (method === "GET" && key === "orders") {
      const actor = await requireMembership(client, "student");
      return result(unwrap(await client.from("orders").select(orderFields).eq("student_id", actor.userId).order("created_at", { ascending: false }).limit(100)));
    }
    if (method === "GET" && path[0] === "orders" && path.length === 2) {
      await session(client);
      const order = unwrap(await client.from("orders").select(orderFields).eq("id", orderId.parse(path[1])).maybeSingle());
      if (!order) throw new BackendError(404, "ORDER_NOT_FOUND", "Order unavailable.");
      return result(order);
    }
    if (method === "POST" && path[0] === "orders" && path.length === 3) {
      const order = orderId.parse(path[1]);
      if (path[2] === "pickup-token") return result(unwrap(await client.rpc("issue_pickup_code", { p_id: order })));
      if (path[2] === "cancel") {
        const input = await body(request, cancellation);
        return result(unwrap(await client.rpc("transition_order", { p_id: order, p_status: "cancelled", p_reason: input.reason ?? null })));
      }
    }
    if (method === "GET" && key === "vendor/orders") {
      const vendor = id.parse(query.get("vendorId"));
      await requireMembership(client, "vendor", vendor);
      return result(unwrap(await client.from("orders").select(orderFields).eq("vendor_id", vendor).order("created_at", { ascending: false }).limit(100)));
    }
    if (method === "POST" && path.length === 4 && path[0] === "vendor" && path[1] === "orders") {
      const order = orderId.parse(path[2]);
      if (path[3] === "transition") {
        const input = await body(request, transitionInput);
        return result(unwrap(await client.rpc("transition_order", { p_id: order, p_status: input.status, p_reason: input.reason ?? null })));
      }
      if (path[3] === "collect") {
        const input = await body(request, collection);
        return result(unwrap(await client.rpc("collect_order", { p_id: order, p_code: input.code, p_counter_confirmed: input.counterConfirmed })));
      }
    }
    if (method === "PATCH" && path.length === 3 && path[0] === "vendor" && path[1] === "capacity") {
      const input = await body(request, settings);
      unwrap(await client.rpc("update_vendor_settings", { p_id: id.parse(path[2]), p_capacity: input.capacity ?? null,
        p_lead: input.leadMinutes ?? null, p_opens: input.opensAt ?? null, p_closes: input.closesAt ?? null, p_paused: input.paused ?? null }));
      return result({ ok: true });
    }
    if (method === "GET" && key === "vendor/menu-items") {
      const vendor = id.parse(query.get("vendorId"));
      await requireMembership(client, "vendor", vendor);
      return result(unwrap(await client.from("menu_items").select(menuFields).eq("vendor_id", vendor).order("name")));
    }
    if (method === "POST" && key === "vendor/menu-items") {
      const input = await body(request, menu);
      unwrap(await client.rpc("save_menu_item", { p_vendor: input.vendorId, p_id: input.id, p_name: input.name,
        p_description: input.description, p_price: input.priceSen, p_stock: input.stock, p_active: input.active,
        p_units: input.workUnits, p_expected_stock: input.expectedStock }));
      return result({ ok: true });
    }
    if (method === "PATCH" && path.length === 3 && path[0] === "admin" && path[1] === "vendors") {
      const input = await body(request, management);
      unwrap(await client.rpc("admin_manage_vendor", { p_id: id.parse(path[2]), p_status: input.status ?? null, p_zone: input.zoneId ?? null, p_reason: input.reason }));
      return result({ ok: true });
    }
    if (method === "POST" && key === "admin/expenses") {
      const input = await body(request, expense);
      return result({ id: unwrap(await client.rpc("record_expense", { p_vendor: input.vendorId, p_amount: input.amountSen, p_label: input.label, p_key: input.idempotencyKey })) }, 201);
    }
    if (method === "POST" && path.length === 4 && path[0] === "admin" && path[1] === "expenses" && path[3] === "reverse") {
      const input = await body(request, reversal);
      return result({ id: unwrap(await client.rpc("reverse_expense", { p_entry: orderId.parse(path[2]), p_reason: input.reason })) }, 201);
    }
    if (method === "GET" && key === "admin/report") {
      await requireMembership(client, "admin");
      return result(await adminReport(client, query));
    }
    if (method === "GET" && key === "admin/audit") {
      await requireMembership(client, "admin");
      return result(unwrap(await client.from("audit_events").select("id,actor_role,action,target,reason,created_at").order("created_at", { ascending: false }).limit(100)));
    }
    throw new BackendError(404, "NOT_FOUND", "Endpoint unavailable.");
  } catch (error) {
    const failure = error instanceof BackendError ? error
      : error instanceof z.ZodError ? new BackendError(400, "INVALID_INPUT", "Review the request fields.")
      : new BackendError(500, "INTERNAL_ERROR", "The service could not complete this request.");
    if (failure.status === 500) console.error("AP Food API failure", { requestId, path: path[0], code: failure.code });
    return result({ error: { code: failure.code, message: failure.message, requestId } }, failure.status);
  }
}
