import { randomUUID } from "node:crypto";
import { z } from "zod";
import { cartOutput, studentCartAction, type StudentCartAction } from "./contracts";
import { BackendError, unwrap } from "./errors";
import type { RequestClient } from "./supabase";

export const cartAdditionInput = z.object({
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(100),
        quantity: z.coerce.number().int().min(1).max(20).default(1),
      }),
    )
    .min(1)
    .max(20),
});
const normalize = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const safe = (name: string) => name.replace(/[\[\]`*<>\r\n]/g, "");

export function parseCartAddition(text: string) {
  const match = text
    .trim()
    .match(
      /^(?:can you |could you |please )?(?:add|put) (.+?)(?: (?:in|to|into) (?:my |the )?cart)?(?: please)?[?.!]*$/i,
    );
  if (!match) return;
  const names = match[1].split(/,\s*|\s+and\s+|\s*&\s*/i);
  const counts: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3 };
  const items = names.map((value) => {
    const quantity = value.trim().match(/^(\d+|a|an|one|two|three)\s*(?:x\s+|×\s+|\s)(.+)$/i);
    return {
      name: quantity ? quantity[2].trim() : value.trim(),
      quantity: quantity ? (counts[quantity[1].toLowerCase()] ?? Number(quantity[1])) : 1,
    };
  });
  return cartAdditionInput.safeParse({ items }).data;
}

export async function prepareStudentCartAddition(
  client: RequestClient,
  userId: string,
  raw: unknown,
): Promise<{ reply: string; cartAction?: StudentCartAction }> {
  const input = cartAdditionInput.parse(raw);
  const [cartResult, vendorsResult] = await Promise.all([
    client.from("carts").select("vendor_id,items,revision").eq("user_id", userId).maybeSingle(),
    client.from("vendors").select("id,paused").eq("status", "approved"),
  ]);
  const saved = cartOutput.parse(unwrap(cartResult) ?? { vendor_id: null, items: [], revision: 0 });
  const vendors = unwrap(vendorsResult) ?? [];
  const menuResult = vendors.length
    ? await client
        .from("menu_items")
        .select("id,vendor_id,name,price_sen,discount_sen,stock,active", { count: "exact" })
        .in(
          "vendor_id",
          vendors.map((vendor) => vendor.id),
        )
    : { data: [], error: null, count: 0 };
  const menu = unwrap(menuResult) ?? [];
  if (menuResult.count !== menu.length)
    throw new BackendError(503, "FIF_UNAVAILABLE", "I could not read the complete menu. Please try again.");
  const items = saved.items.map((item) => ({ ...item, vendorId: item.vendorId ?? saved.vendor_id! }));
  const added: StudentCartAction["added"] = [];
  const issues: string[] = [];
  for (const request of input.items) {
    const matches = menu.filter((item) => normalize(item.name) === normalize(request.name));
    if (matches.length !== 1) {
      issues.push(
        matches.length
          ? `${safe(request.name)} matches more than one stall; please choose the stall.`
          : `${safe(request.name)} was not found on the published menu.`,
      );
      continue;
    }
    const item = matches[0];
    const existingQuantity = items
      .filter((line) => line.itemId === item.id)
      .reduce((sum, line) => sum + line.quantity, 0);
    const existing = items.find((line) => line.itemId === item.id && !line.extra);
    if (
      !item.active ||
      vendors.find((vendor) => vendor.id === item.vendor_id)?.paused ||
      existingQuantity + request.quantity > item.stock ||
      (existing?.quantity ?? 0) + request.quantity > 20
    ) {
      issues.push(`${safe(item.name)} is unavailable in the requested quantity.`);
      continue;
    }
    if (existing) existing.quantity += request.quantity;
    else items.push({ itemId: item.id, vendorId: item.vendor_id, quantity: request.quantity, extra: false });
    const prior = added.find((line) => line.itemId === item.id);
    if (prior) prior.quantity += request.quantity;
    else
      added.push({
        itemId: item.id,
        name: item.name,
        quantity: request.quantity,
        unitPriceSen: item.price_sen - item.discount_sen,
      });
  }
  if (!added.length)
    return { reply: `${issues.join(" ")} Nothing has been added. Please name the menu item and quantity you want.` };
  if (items.length > 20)
    throw new BackendError(
      409,
      "INVALID_CART",
      "Your cart has reached its item limit. Review it before adding another item.",
    );
  const description = added.map((item) => `${item.quantity} × ${safe(item.name)}`).join(", ");
  const cartAction = studentCartAction.parse({
    id: randomUUID(),
    userId,
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    description,
    issues,
    added,
    cart: { vendorId: saved.vendor_id ?? items[0].vendorId, items, revision: saved.revision },
  });
  return {
    reply: `${issues.join(" ")}${issues.length ? "\n\n" : ""}Ready to add ${description}. Confirm below or say “yes please”. Your cart has not changed yet.`,
    cartAction,
  };
}
