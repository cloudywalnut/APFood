"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { basketLine, basketCheckoutInput, cartOutput, checkoutInput, id } from "./contracts";
import { ApiError, createHostedData } from "./client";

const attemptSchema = z.union([checkoutInput, basketCheckoutInput]);
const schema = z.object({ vendorId: id, items: z.array(basketLine).min(1).max(20), pending: attemptSchema.optional() });
type Cart = z.infer<typeof schema>;
const guestKey = "ap-food-guest-cart";
const eventName = "ap-food-cart-changed";
const revisionKey = "ap-food-cart-revision";

function broadcastCart() {
  // The marker contains no cart data; storage events invalidate other tabs.
  try { localStorage.setItem(revisionKey, crypto.randomUUID()); } catch { /* Refetch on focus still works. */ }
  window.dispatchEvent(new Event(eventName));
}

function readCart(storage: Storage, key: string) {
  try {
    const raw = storage.getItem(key);
    return raw ? schema.safeParse(JSON.parse(raw)).data : undefined;
  } catch { return undefined; }
}

export function useHostedCart(userId?: string) {
  const api = useMemo(() => createHostedData(userId), [userId]);
  const [remote, setRemote] = useState<z.infer<typeof cartOutput>>();
  const [guest, setGuest] = useState<Cart>();
  const [pending, setPending] = useState<Cart>();
  const [conflict, setConflict] = useState<Cart>();
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const pendingKey = "ap-food-checkout:" + (userId ?? "guest");
  const running = useRef(false);

  const load = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const local = readCart(localStorage, guestKey) ??
        (userId ? readCart(sessionStorage, "ap-food-cart:" + userId) : undefined);
      setGuest(local);
      if (!local) setConflict(undefined);
      if (!userId) { setReady(true); return; }
      const attempt = readCart(sessionStorage, pendingKey);
      const legacy = readCart(sessionStorage, "ap-food-cart:" + userId);
      setPending(attempt ?? (legacy?.pending ? legacy : undefined));
      let next = await api.cart();
      if (local && !local.pending) {
        if (next.items.length) setConflict(local);
        else {
          next = await api.saveCart({ vendorId: local.vendorId, items: local.items, revision: next.revision });
          localStorage.removeItem(guestKey);
          sessionStorage.removeItem("ap-food-cart:" + userId);
          setGuest(undefined);
          setConflict(undefined);
        }
      }
      setRemote(next);
      setError("");
      setReady(true);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Your cart could not be loaded.");
      setReady(true);
    } finally { running.current = false; }
  }, [api, userId, pendingKey]);

  useEffect(() => {
    setReady(false);
    setRemote(undefined);
    setPending(undefined);
    void load();
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener("storage", refresh);
    window.addEventListener(eventName, refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(eventName, refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);

  const cart: Cart | undefined = pending ?? (!userId ? guest : remote?.vendor_id && remote.items.length ? {
    vendorId: remote.vendor_id, items: remote.items,
  } : undefined);

  async function save(next?: Cart) {
    if (pending?.pending) throw new Error("Resolve the pending checkout before changing your cart.");
    if (userId) {
      if (!remote) throw new Error("Wait for your saved cart to load.");
      try {
        setRemote(await api.saveCart({ vendorId: next?.vendorId ?? null, items: next?.items ?? [], revision: remote.revision }));
      } catch (problem) {
        if (problem instanceof ApiError && problem.code === "CART_CHANGED") await load();
        throw problem;
      }
    } else {
      try {
        if (next) localStorage.setItem(guestKey, JSON.stringify(schema.parse(next)));
        else localStorage.removeItem(guestKey);
      } catch { throw new Error("Your browser could not save the cart. Check storage settings."); }
      setGuest(next);
    }
    broadcastCart();
    setError("");
  }

  function persistAttempt(attempt: z.infer<typeof attemptSchema>) {
    if (!cart) throw new Error("Add an item before checking out.");
    const saved = { ...cart, pending: attempt };
    try { sessionStorage.setItem(pendingKey, JSON.stringify(saved)); }
    catch { throw new Error("This browser could not save the checkout. Check storage settings."); }
    setPending(saved);
  }

  function clearAttempt() {
    sessionStorage.removeItem(pendingKey);
    if (userId) sessionStorage.removeItem("ap-food-cart:" + userId);
    setPending(undefined);
    void load();
    broadcastCart();
  }

  async function resolveImport(replace: boolean) {
    // Resolve before broadcasting: a refresh must not import the guest cart again.
    if (replace && conflict) {
      if (!remote) throw new Error("Wait for your saved cart to load.");
      try {
        setRemote(await api.saveCart({ vendorId: conflict.vendorId, items: conflict.items, revision: remote.revision }));
      } catch (problem) {
        if (problem instanceof ApiError && problem.code === "CART_CHANGED") await load();
        throw problem;
      }
    }
    localStorage.removeItem(guestKey);
    if (userId) sessionStorage.removeItem("ap-food-cart:" + userId);
    setConflict(undefined);
    setGuest(undefined);
    broadcastCart();
  }

  return { cart, save, persistAttempt, clearAttempt, revision: remote?.revision, ready, error,
    reload: load, conflict, resolveImport };
}

const rejected = new Set(["QUOTE_EXPIRED", "QUOTE_USED", "SLOT_UNAVAILABLE", "PRICE_CHANGED",
  "OUT_OF_STOCK", "STALL_UNAVAILABLE", "ITEM_UNAVAILABLE", "INVALID_CART", "INVALID_CHECKOUT",
  "IDEMPOTENCY_KEY_REUSED", "CART_CHANGED", "PAYMENT_UNAVAILABLE"]);

export function isRejectedCheckout(error: unknown) {
  return error instanceof ApiError && rejected.has(error.code);
}
