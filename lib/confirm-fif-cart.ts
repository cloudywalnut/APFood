import { studentCartAction, type cartOutput, type catalogueOutput, type cartInput } from "./backend/contracts";
import type { z } from "zod";

type Cart = z.infer<typeof cartOutput>;
type Api = {
  cart: () => Promise<Cart>;
  catalogue: () => Promise<z.infer<typeof catalogueOutput>>;
  saveCart: (input: z.infer<typeof cartInput>) => Promise<Cart>;
};
const lines = (items: Cart["items"], vendor: string | null) =>
  JSON.stringify(
    items
      .map((item) => [item.vendorId ?? vendor, item.itemId, item.extra, item.quantity])
      .sort((a, b) => String(a).localeCompare(String(b))),
  );

export async function confirmFifCart(api: Api, userId: string, raw: unknown) {
  const action = studentCartAction.parse(raw);
  if (action.userId !== userId) throw new Error("This cart suggestion belongs to another account.");
  const matches = (cart: Cart) =>
    cart.revision === action.cart.revision + 1 &&
    cart.vendor_id === action.cart.vendorId &&
    lines(cart.items, cart.vendor_id) === lines(action.cart.items, action.cart.vendorId);
  const current = await api.cart();
  if (matches(current)) return current;
  if (Date.now() > Date.parse(action.expiresAt))
    throw new Error("This suggestion expired. Ask me to prepare it again.");
  if (current.revision !== action.cart.revision)
    throw new Error("Your cart changed. Ask me to prepare the addition again so your newer changes are preserved.");
  const catalogue = await api.catalogue();
  for (const added of action.added) {
    const item = catalogue.items.find((item) => item.id === added.itemId);
    const vendor = catalogue.vendors.find((vendor) => vendor.id === item?.vendor_id);
    const quantity = action.cart.items
      .filter((line) => line.itemId === added.itemId)
      .reduce((sum, line) => sum + line.quantity, 0);
    if (!item?.active || !vendor || vendor.status !== "approved" || vendor.paused || item.stock < quantity)
      throw new Error(`${added.name} is no longer available in that quantity. Ask me to check it again.`);
    if (item.price_sen - item.discount_sen !== added.unitPriceSen)
      throw new Error(`${added.name}'s price changed. Ask me to prepare a fresh suggestion.`);
  }
  try {
    const saved = await api.saveCart(action.cart);
    if (!matches(saved)) throw new Error("The saved cart did not match the requested addition.");
    return saved;
  } catch (error) {
    // Recover an uncertain response or simultaneous confirmation without adding twice.
    const recovered = await api.cart().catch(() => undefined);
    if (recovered && matches(recovered)) return recovered;
    throw error;
  }
}
