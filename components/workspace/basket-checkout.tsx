"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Zap } from "lucide-react";
import { apiClient } from "../../lib/backend/client";
import { isRejectedCheckout, useCart } from "../../lib/backend/cart";
import { money } from "../../lib/orders";
import { pickupWindow } from "../../lib/pickup-time";
import { ErrorMessage } from "../shared";
import { messageOf, useApi } from "./common";
import { CheckoutBasketPreview } from "../storefront/checkout-summary";

type Store = ReturnType<typeof useCart>;
type Quote = Awaited<ReturnType<typeof apiClient.quote>> & {
  vendorId: string;
  name: string;
  payment: "counter" | "duitnow_qr";
};

export function BasketCheckout({ store }: { store: Store }) {
  const api = useApi();
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [revision, setRevision] = useState<number>();
  const [mode, setMode] = useState<"now" | "later">("now");
  const [slot, setSlot] = useState("");
  const [preferQr, setPreferQr] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const cart = store.cart;
  const cartItems = cart?.items;
  const cartVendorId = cart?.vendorId;
  const hasPending = Boolean(cart?.pending);
  const hasConflict = Boolean(store.conflict);
  const cartRevision = store.revision;

  const requestQuotes = useCallback(async () => {
    if (!cartItems?.length) return [];
    const vendors = await api.vendors();
    const ids = [...new Set(cartItems.map((line) => line.vendorId ?? cartVendorId!))];
    return Promise.all(
      ids.map(async (vendorId) => {
        const details = preferQr ? await api.vendorPayment(vendorId) : null;
        const payment = details ? ("duitnow_qr" as const) : ("counter" as const);
        const items = cartItems
          .filter((line) => (line.vendorId ?? cartVendorId) === vendorId)
          .map(({ itemId, quantity, extra }) => ({ itemId, quantity, extra }));
        return {
          ...(await api.quote({ vendorId, items, payment })),
          vendorId,
          payment,
          name: vendors.find((row) => row.id === vendorId)?.name ?? vendorId,
        };
      }),
    );
  }, [api, cartItems, cartVendorId, preferQr]);

  useEffect(() => {
    if (!cartItems?.length || hasPending || hasConflict) return;
    let active = true;
    setQuoting(true);
    setQuotes([]);
    setError("");
    requestQuotes()
      .then((next) => {
        if (!active) return;
        setRevision(cartRevision);
        setQuotes(next);
        const shared =
          next[0]?.slots.filter((value) =>
            next.every((quote) => quote.slots.some((other) => Date.parse(other) === Date.parse(value))),
          ) ?? [];
        setSlot(shared[1] ?? shared[0] ?? "");
      })
      .catch((problem) => {
        if (active) setError(messageOf(problem));
      })
      .finally(() => {
        if (active) setQuoting(false);
      });
    return () => {
      active = false;
    };
  }, [cartItems?.length, cartRevision, hasPending, hasConflict, requestQuotes]);

  if (!cart?.items.length)
    return (
      <section className="panel">
        <h1>Your cart is empty</h1>
        <Link href="/app/vendors">Explore stalls</Link>
      </section>
    );
  const slots =
    quotes[0]?.slots.filter((value) =>
      quotes.every((quote) => quote.slots.some((other) => Date.parse(other) === Date.parse(value))),
    ) ?? [];
  const chosenSlot = mode === "now" ? (slots[0] ?? "") : slots.includes(slot) ? slot : (slots[1] ?? slots[0] ?? "");
  const expired = quotes.some((quote) => Date.parse(quote.expiresAt) <= now);
  const changed = revision !== undefined && revision !== store.revision;
  async function run(action: () => Promise<void>) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (problem) {
      setError(messageOf(problem));
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  async function getQuotes() {
    setQuoting(true);
    setQuotes([]);
    try {
      const next = await requestQuotes();
      setRevision(store.revision);
      setQuotes(next);
      const shared =
        next[0]?.slots.filter((value) =>
          next.every((quote) => quote.slots.some((other) => Date.parse(other) === Date.parse(value))),
        ) ?? [];
      setSlot(shared[1] ?? shared[0] ?? "");
    } finally {
      setQuoting(false);
    }
  }
  async function place() {
    if (!cart || (!chosenSlot && !cart.pending)) return;
    const attempt =
      cart.pending ??
      (revision !== undefined
        ? {
            orders: quotes.map((quote) => ({
              vendorId: quote.vendorId,
              quoteId: quote.quoteId,
              pickupAt: chosenSlot,
              payment: quote.payment,
              idempotencyKey: crypto.randomUUID(),
            })),
            idempotencyKey: crypto.randomUUID(),
            cartRevision: revision,
          }
        : undefined);
    if (!attempt) return;
    if (!cart.pending) store.persistAttempt(attempt);
    try {
      const result = "orders" in attempt ? await api.placeBasket(attempt) : { orders: [await api.place(attempt)] };
      store.clearAttempt();
      router.replace(result.orders.length === 1 ? "/app/orders/" + result.orders[0].id : "/app/orders");
    } catch (problem) {
      if (isRejectedCheckout(problem)) {
        store.clearAttempt();
        setQuotes([]);
      }
      throw problem;
    }
  }
  return (
    <div className="stack">
      <Link className="quiet-link back-link" href="/app/cart">
        Back to cart
      </Link>
      <div className="student-heading">
        <div>
          <h1>Checkout</h1>
          <p>Order right now for the soonest pickup, or schedule a pickup window for later.</p>
        </div>
      </div>
      {cart.pending ? (
        <section className="panel stack">
          <h2>Recover your checkout</h2>
          <p>Retry the saved request to confirm the original orders safely.</p>
          <button className="button primary" disabled={busy} onClick={() => void run(place)}>
            Retry the same checkout
          </button>
        </section>
      ) : (
        <div className="checkout-layout">
          <section className="panel stack">
            <h2>When do you want your food?</h2>
            <div className="checkout-mode-grid" role="radiogroup" aria-label="Order timing">
              <button
                type="button"
                role="radio"
                aria-checked={mode === "now"}
                className="checkout-mode-card"
                onClick={() => setMode("now")}
              >
                <Zap size={19} aria-hidden />
                <span>
                  <strong>Order right now</strong>
                  <small>
                    {slots[0] ? "Soonest pickup · " + pickupWindow(slots[0]) : "Earliest available kitchen slot"}
                  </small>
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={mode === "later"}
                className="checkout-mode-card"
                onClick={() => setMode("later")}
              >
                <CalendarClock size={19} aria-hidden />
                <span>
                  <strong>Schedule for later</strong>
                  <small>Pick a 15-minute window up to 2 hours ahead</small>
                </span>
              </button>
            </div>
            {quoting && !quotes.length && (
              <p className="muted small" role="status">
                Checking kitchen availability…
              </p>
            )}
            {quotes.length > 0 &&
              mode === "now" &&
              (slots[0] ? (
                <div className="checkout-asap-note">
                  <strong>Ready around {pickupWindow(slots[0])}</strong>
                  <p className="small muted">Prepared immediately using each stall’s earliest available window.</p>
                </div>
              ) : (
                <p className="error">
                  No immediate pickup window fits all stalls. Try scheduling for later or updating your cart.
                </p>
              ))}
            {quotes.length > 0 &&
              mode === "later" &&
              (slots.length ? (
                <fieldset className="slot-grid">
                  <legend className="sr-only">Shared pickup time</legend>
                  {slots.map((value, index) => (
                    <label key={value} className="slot-option">
                      <input
                        type="radio"
                        name="pickup"
                        checked={chosenSlot === value}
                        onChange={() => setSlot(value)}
                      />
                      <span>
                        <strong>{pickupWindow(value)}</strong>
                        {index === 0 && <small>Earliest available</small>}
                      </span>
                    </label>
                  ))}
                </fieldset>
              ) : (
                <p className="error">No shared pickup window fits all stalls. Update your cart or try again later.</p>
              ))}
            <h2>Payment preference</h2>
            <fieldset className="choice-list">
              <legend className="sr-only">Payment method</legend>
              <label>
                <input type="radio" checked={!preferQr} onChange={() => setPreferQr(false)} />
                Pay at counter
              </label>
              <label>
                <input type="radio" checked={preferQr} onChange={() => setPreferQr(true)} />
                DuitNow QR
              </label>
            </fieldset>
            <p className="small muted">Stalls without a merchant QR use pay at counter.</p>
            <button
              type="button"
              className="button secondary"
              disabled={busy || quoting || Boolean(store.conflict)}
              onClick={() => void run(getQuotes)}
            >
              {quoting ? "Checking availability…" : "Refresh availability"}
            </button>
          </section>
          <section className="panel stack">
            <h2>Order summary</h2>
            {!quotes.length && <CheckoutBasketPreview cart={cart} />}
            {quotes.map((quote) => (
              <div key={quote.vendorId}>
                <h3>{quote.name}</h3>
                {quote.lines.map((line) => (
                  <p className="line spread" key={line.itemId + line.extra}>
                    <span>
                      {line.quantity} × {line.name}
                      {line.extra && " + side"}
                    </span>
                    <strong>{money(line.unit * line.quantity)}</strong>
                  </p>
                ))}
                <p className="small muted">
                  {quote.payment === "duitnow_qr" ? "DuitNow QR · Confirm payment after placing" : "Pay at counter"}
                </p>
              </div>
            ))}
            {quotes.length > 0 && (
              <>
                <div className="line spread cart-total">
                  <strong>Total</strong>
                  <strong>{money(quotes.reduce((sum, quote) => sum + quote.totalSen, 0))}</strong>
                </div>
                {(expired || changed) && (
                  <p className="error">
                    {changed ? "Your cart changed." : "Your quote expired."} Refresh availability before continuing.
                  </p>
                )}
                <button
                  className="button primary"
                  disabled={busy || quoting || !chosenSlot || expired || changed || Boolean(store.conflict)}
                  onClick={() => void run(place)}
                >
                  {busy
                    ? "Placing…"
                    : quotes.some((quote) => quote.payment === "duitnow_qr")
                      ? "Continue to payment"
                      : mode === "now"
                        ? "Order right now"
                        : "Schedule order"}
                </button>
              </>
            )}
          </section>
        </div>
      )}
      <ErrorMessage message={error} />
    </div>
  );
}
