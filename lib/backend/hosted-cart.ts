"use client";

import { useMemo, useSyncExternalStore } from "react";
import { z } from "zod";
import { cartLine, checkoutInput, id, type CheckoutInput } from "./contracts";

const schema = z.object({ vendorId: id, items: z.array(cartLine).max(20), pending: checkoutInput.optional() });
type Cart = z.infer<typeof schema>;
const eventName = "ap-food-hosted-cart";

function subscribe(listener: () => void) {
  window.addEventListener(eventName, listener);
  return () => window.removeEventListener(eventName, listener);
}

export function useHostedCart(userId: string) {
  const key = "ap-food-cart:" + userId;
  const raw = useSyncExternalStore(subscribe, () => {
    try { return sessionStorage.getItem(key); } catch { return null; }
  }, () => null);
  const cart = useMemo(() => {
    try { return raw ? schema.safeParse(JSON.parse(raw)).data : undefined; }
    catch { return undefined; }
  }, [raw]);

  function save(next?: Cart) {
    try {
      if (next) sessionStorage.setItem(key, JSON.stringify(schema.parse(next)));
      else sessionStorage.removeItem(key);
    } catch {
      throw new Error("This tab could not save the cart. Check your browser storage settings before checkout.");
    }
    window.dispatchEvent(new Event(eventName));
  }

  function persistAttempt(attempt: CheckoutInput) {
    if (!cart) throw new Error("Add an item before checking out.");
    save({ ...cart, pending: attempt });
  }

  return { cart, save, persistAttempt };
}

const rejected = new Set(["QUOTE_EXPIRED", "QUOTE_USED", "SLOT_UNAVAILABLE", "PRICE_CHANGED",
  "OUT_OF_STOCK", "STALL_UNAVAILABLE", "ITEM_UNAVAILABLE", "INVALID_CART", "INVALID_CHECKOUT",
  "IDEMPOTENCY_KEY_REUSED"]);

export function isRejectedCheckout(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error &&
    typeof error.code === "string" && rejected.has(error.code);
}
