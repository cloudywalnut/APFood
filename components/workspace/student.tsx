"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronRight, CircleCheck, Clock3, MapPin, ShieldCheck } from "lucide-react";
import { addonPrice, canCancelOrder, isActive, money, statusNames } from "../../lib/orders";
import { apiClient } from "../../lib/backend/client";
import { useCart } from "../../lib/backend/cart";
import { subscribeToOrders } from "../../lib/backend/realtime";
import { pickupWindow } from "../../lib/pickup-time";
import { canShowPickup, trackingCopy } from "../../lib/tracking";
import { Empty, ErrorMessage, Modal, StatusBadge, StudentShell } from "../shared";
import { TabBar } from "../ui/primitives";
import { WarmIllustration } from "../ui/illustration";
import { PickupDialog } from "./pickup-dialog";
import { OptionalSession, WorkspaceAccess, messageOf, RemoteStatus, useApi, useRemote } from "./common";
import { TrafficView } from "./traffic";
import { OrderPayment } from "./payments";
import { BasketCheckout } from "./basket-checkout";
import { OrderTracking } from "./tracking";
import { CampusMarketplace } from "./marketplace";
import { RestaurantMenu } from "../storefront/menu";
import { StorefrontCart } from "../storefront/cart";

type CartAccess = ReturnType<typeof useCart>;
type MenuItem = Awaited<ReturnType<typeof apiClient.menu>>[number];

export function StudentWorkspace({
  route,
  section,
  id,
  itemId,
}: {
  route: string;
  section: string;
  id?: string;
  itemId?: string;
}) {
  return (
    <OptionalSession>
      {(session) =>
        session?.memberships.some((entry) => entry.role === "vendor") ? (
          <WorkspaceAccess role="student">{() => null}</WorkspaceAccess>
        ) : (
          <StudentContent
            key={session?.userId ?? "guest"}
            route={route}
            section={section}
            id={id}
            itemId={itemId}
            signedIn={Boolean(session)}
            userId={session?.profile.status === "active" && session.emailVerified ? session.userId : undefined}
          />
        )
      }
    </OptionalSession>
  );
}

function StudentContent({
  route,
  section,
  id,
  signedIn,
  userId,
  itemId,
}: {
  route: string;
  section: string;
  id?: string;
  signedIn: boolean;
  userId?: string;
  itemId?: string;
}) {
  const cart = useCart(userId);
  return (
    <StudentShell
      route={route}
      signedIn={signedIn}
      cartCount={cart.cart?.items.reduce((count, item) => count + item.quantity, 0) ?? 0}
    >
      {cart.conflict && <CartImport store={cart} />}
      {cart.error && (
        <div className="notice">
          <p role="alert">{cart.error}</p>
          <button className="button secondary" onClick={() => void cart.reload()}>
            Reload saved cart
          </button>
        </div>
      )}
      {section === "home" && <CampusMarketplace signedIn={Boolean(userId)} userId={userId} />}
      {section === "map" && <CampusMarketplace signedIn={Boolean(userId)} userId={userId} map />}
      {section === "area" && <CampusMarketplace signedIn={Boolean(userId)} userId={userId} areaId={id} map />}
      {section === "vendors" &&
        (id ? (
          <Menu key={id} id={id} store={cart} itemId={itemId} />
        ) : (
          <CampusMarketplace signedIn={Boolean(userId)} userId={userId} />
        ))}
      {section === "cart" &&
        (cart.ready ? (
          <StorefrontCart store={cart} signedIn={Boolean(userId)} />
        ) : (
          <p role="status">Loading your cart…</p>
        ))}
      {section === "checkout" &&
        (userId ? (
          cart.ready ? (
            <BasketCheckout store={cart} />
          ) : (
            <p role="status">Loading your cart…</p>
          )
        ) : (
          <SignInToOrder next="/app/checkout" />
        ))}
      {section === "orders" &&
        (userId ? (
          id ? (
            <OrderDetail key={id} id={id} userId={userId} />
          ) : (
            <Orders key="orders" userId={userId} />
          )
        ) : (
          <SignInToOrder next={route} />
        ))}
      {section === "history" &&
        (userId ? (
          <Orders key="history" userId={userId} defaultTab="history" />
        ) : (
          <SignInToOrder next="/app/history" />
        ))}
      {section === "traffic" && <TrafficView />}
    </StudentShell>
  );
}

function SignInToOrder({ next }: { next: string }) {
  return (
    <Empty
      art="explore_cafeteria"
      title="Make it yours."
      detail="Sign in to save your cart, place an order, and track your pickup."
      href={"/auth/login?next=" + encodeURIComponent(next)}
      action="Sign in to continue"
    />
  );
}

function CartImport({ store }: { store: CartAccess }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="panel stack">
      <h2>You have a saved cart</h2>
      <p>Keep your account's cart or replace it with the items you selected before signing in.</p>
      <div className="line wrap">
        {[false, true].map((replace) => (
          <button
            key={String(replace)}
            className={"button " + (replace ? "primary" : "secondary")}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await store.resolveImport(replace);
              } catch (problem) {
                setError(messageOf(problem));
              } finally {
                setBusy(false);
              }
            }}
          >
            {replace ? "Replace with this cart" : "Keep saved cart"}
          </button>
        ))}
      </div>
      <ErrorMessage message={error} />
    </section>
  );
}

function Menu({ id, store, itemId }: { id: string; store: CartAccess; itemId?: string }) {
  const load = useCallback(async () => {
    const [vendors, items] = await Promise.all([apiClient.vendors(), apiClient.menu(id)]);
    return { vendor: vendors.find((vendor) => vendor.id === id), items };
  }, [id]);
  const result = useRemote(load);
  const [item, setItem] = useState<MenuItem>();
  useEffect(() => {
    if (itemId && result.value) setItem(result.value.items.find((row) => row.id === itemId));
  }, [itemId, result.value]);
  if (!result.value) return <RemoteStatus error={result.error} reload={result.reload} />;
  const { vendor, items } = result.value;
  if (!vendor)
    return (
      <Empty
        title="Stall unavailable"
        detail="Choose another campus stall."
        href="/app/vendors"
        action="Explore vendors"
      />
    );
  return (
    <>
      <RestaurantMenu vendor={vendor} items={items} store={store} onAdd={setItem} />
      {item && (
        <MealOptions
          item={item}
          store={store}
          close={() => setItem(undefined)}
          added={() => {
            window.dispatchEvent(new CustomEvent("apfoods-notice", { detail: item.name + " added to cart." }));
            setItem(undefined);
          }}
        />
      )}
    </>
  );
}

function MealOptions({
  item,
  store,
  close,
  added,
}: {
  item: MenuItem;
  store: CartAccess;
  close: () => void;
  added: () => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [extra, setExtra] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const items = (store.cart?.items ?? []).map((line) => ({ ...line, vendorId: line.vendorId ?? store.cart!.vendorId }));
  const maximum = Math.min(
    20,
    item.stock - items.filter((line) => line.itemId === item.id).reduce((sum, line) => sum + line.quantity, 0),
  );
  return (
    <Modal
      title={item.name}
      close={() => {
        if (!busy) close();
      }}
    >
      <form
        className="stack"
        onSubmit={async (event) => {
          event.preventDefault();
          if (store.cart?.pending || !Number.isInteger(quantity) || quantity < 1 || quantity > maximum) return;
          const exists = items.some((line) => line.itemId === item.id && line.extra === extra);
          const next = exists
            ? items.map((line) =>
                line.itemId === item.id && line.extra === extra
                  ? { ...line, quantity: line.quantity + quantity }
                  : line,
              )
            : [...items, { itemId: item.id, vendorId: item.vendor_id, quantity, extra }];
          setBusy(true);
          try {
            await store.save({ vendorId: store.cart?.vendorId ?? item.vendor_id, items: next });
            added();
          } catch (problem) {
            setError(messageOf(problem));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="check">
          <input type="checkbox" checked={extra} onChange={(event) => setExtra(event.target.checked)} /> Add a side ·{" "}
          {money(addonPrice)}
        </label>
        {maximum > 0 ? (
          <label className="field">
            Quantity
            <input
              required
              type="number"
              min="1"
              max={maximum}
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
            />
          </label>
        ) : (
          <p>All available portions are already in your cart.</p>
        )}
        <ErrorMessage message={error} />
        <button className="button primary" disabled={maximum < 1 || busy || !store.ready}>
          {busy ? "Saving…" : "Add to cart"} ·{" "}
          {money((item.price_sen - item.discount_sen + (extra ? addonPrice : 0)) * quantity)}
        </button>
      </form>
    </Modal>
  );
}

function Orders({ userId, defaultTab = "all" }: { userId: string; defaultTab?: "all" | "active" | "history" }) {
  const api = useApi();
  const orders = useRemote(api.orders);
  const catalogue = useRemote(apiClient.catalogue);
  const [tab, setTab] = useState(defaultTab);
  useEffect(() => subscribeToOrders({ studentId: userId }, orders.reload), [userId, orders.reload]);
  const stalls = new Map(catalogue.value?.vendors.map((vendor) => [vendor.id, vendor.name]) ?? []);
  const visible =
    orders.value?.filter(
      (order) => tab === "all" || (tab === "active" ? isActive(order.status) : !isActive(order.status)),
    ) ?? [];
  return (
    <>
      <div className="student-heading">
        <div>
          <h1>{defaultTab === "history" ? "Order history" : "Orders"}</h1>
          <p>
            {defaultTab === "history"
              ? "Review completed, cancelled, and rejected campus pickups."
              : "Track active pickups and find previous orders."}
          </p>
        </div>
      </div>
      {orders.value && orders.value.length > 0 && (
        <TabBar
          label="Order list"
          value={tab}
          onChange={(value) => setTab(value as "all" | "active" | "history")}
          tabs={[
            { id: "all", label: "All orders" },
            { id: "active", label: "Active" },
            { id: "history", label: "History" },
          ]}
        />
      )}
      {!orders.value ? (
        <RemoteStatus error={orders.error} reload={orders.reload} />
      ) : visible.length ? (
        <div className="panel orders-list">
          {visible.map((order) => (
            <Link className="order-list-row" href={"/app/orders/" + order.id} key={order.id}>
              <span>
                <strong>{stalls.get(order.vendor_id) ?? order.vendor_id}</strong>
                <small>
                  {order.id.slice(0, 8).toUpperCase()} · {pickupWindow(order.pickup_at)}
                </small>
              </span>
              <StatusBadge status={order.status} />
              <strong>{money(order.total_sen)}</strong>
              <ChevronRight size={16} aria-hidden />
            </Link>
          ))}
        </div>
      ) : orders.value.length ? (
        <Empty title="No orders in this filter" detail="Switch tabs to view your other campus pickups." />
      ) : (
        <Empty
          title="No orders yet"
          detail="Your pickups appear after checkout."
          href="/app/vendors"
          action="Explore vendors"
        />
      )}
    </>
  );
}

function OrderDetail({ id, userId }: { id: string; userId: string }) {
  const api = useApi();
  const load = useCallback(() => api.order(id), [id, api]);
  const result = useRemote(load);
  const catalogue = useRemote(apiClient.catalogue);
  const [credential, setCredential] = useState<Awaited<ReturnType<typeof apiClient.issuePickup>>>();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => subscribeToOrders({ studentId: userId }, result.reload), [userId, result.reload]);
  if (!result.value) return <RemoteStatus error={result.error} reload={result.reload} />;
  const order = result.value;
  const vendor = catalogue.value?.vendors.find((entry) => entry.id === order.vendor_id);
  const zone = catalogue.value?.zones.find((entry) => entry.id === (vendor?.zone_id ?? order.zone_id));
  const copy = trackingCopy[order.status];
  const terminal = order.status === "cancelled" || order.status === "rejected";
  const itemCount = order.lines.reduce((sum, line) => sum + line.quantity, 0);
  const paymentNote =
    order.payment === "duitnow_qr"
      ? {
          pending: "Awaiting QR payment confirmation",
          paid: "QR payment confirmed",
          expired: "Payment window expired",
          refund_pending: "Refund pending from stall",
          refunded: "Refund recorded",
        }[order.payment_record?.status ?? "pending"]
      : order.payment === "counter"
        ? order.status === "collected"
          ? "Confirmed at counter"
          : terminal
            ? "No counter payment collected"
            : "Pay when you collect"
        : "Online demo payment";
  const issue = async () => {
    setCredential(await api.issuePickup(id));
  };
  return (
    <>
      <Link className="quiet-link back-link" href="/app/orders">
        <ArrowLeft size={16} aria-hidden />
        Order history
      </Link>
      <header className="track-heading">
        <div>
          <p className="caf-eyebrow">YOUR CAMPUS PICKUP</p>
          <h1>
            {order.status === "ready"
              ? "Ready for pickup"
              : order.status === "collected"
                ? "Order collected"
                : "Track your order"}
          </h1>
          <p>
            Order {order.id.slice(0, 8).toUpperCase()} · {vendor?.name ?? order.vendor_id} ·{" "}
            {zone?.name ?? order.zone_id}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </header>
      <div className="track-layout">
        <div className="track-main">
          <section className={"panel track-hero " + (terminal ? "terminal" : "")}>
            <WarmIllustration name={copy.art} />
            <div>
              <span className="caf-eyebrow">{statusNames[order.status]}</span>
              <h2>{copy.title}</h2>
              <p>{copy.description}</p>
              <strong className="track-pickup-time">
                <Clock3 size={16} aria-hidden />
                {pickupWindow(order.pickup_at)}
              </strong>
              {order.status === "collected" && (
                <span className="track-complete">
                  <CircleCheck size={16} aria-hidden />
                  Collection confirmed
                </span>
              )}
              <div className="line wrap">
                {canShowPickup(order.status) && (
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        await issue();
                      } catch (problem) {
                        setError(messageOf(problem));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Show pickup code
                  </button>
                )}
                {canCancelOrder(order.status) && (
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => {
                      setError("");
                      setConfirmCancel(true);
                    }}
                  >
                    Cancel order
                  </button>
                )}
                {terminal && (
                  <Link className="button secondary" href="/app/vendors">
                    Explore cafeteria <ArrowRight size={15} aria-hidden />
                  </Link>
                )}
              </div>
              {!confirmCancel && <ErrorMessage message={error} />}
            </div>
          </section>
          {order.payment === "duitnow_qr" && (
            <OrderPayment customer id={id} total={order.total_sen} version={order.version} changed={result.reload} />
          )}
          <OrderTracking order={order} />
        </div>
        <aside className="track-aside">
          <section className="panel track-facts">
            <h2>Pickup details</h2>
            <dl>
              <div>
                <dt>
                  <Clock3 size={15} aria-hidden />
                  Pickup time
                </dt>
                <dd>{pickupWindow(order.pickup_at)}</dd>
              </div>
              <div>
                <dt>
                  <MapPin size={15} aria-hidden />
                  Collect from
                </dt>
                <dd>
                  {vendor?.name ?? order.vendor_id}
                  <small>{zone?.name ?? order.zone_id}</small>
                </dd>
              </div>
              <div>
                <dt>
                  <ShieldCheck size={15} aria-hidden />
                  Payment
                </dt>
                <dd>
                  {order.payment === "duitnow_qr"
                    ? "DuitNow QR"
                    : order.payment === "counter"
                      ? "Pay at counter"
                      : "Online payment"}
                  <small>{paymentNote}</small>
                </dd>
              </div>
              <div>
                <dt>Order status</dt>
                <dd>
                  <StatusBadge status={order.status} />
                </dd>
              </div>
            </dl>
            <Link className="quiet-link" href={"/app/vendors/" + order.vendor_id}>
              View stall menu <ArrowRight size={15} aria-hidden />
            </Link>
          </section>
          <section className="panel track-accordions">
            <details open className="ap-accordion">
              <summary>
                Order breakdown{" "}
                <span>
                  {itemCount} {itemCount === 1 ? "item" : "items"} · {money(order.total_sen)}
                </span>
              </summary>
              <div>
                {order.lines.map((line) => (
                  <div className="track-order-line" key={line.itemId + line.extra}>
                    <span>
                      <strong>
                        {line.quantity} × {line.name}
                      </strong>
                      <small>
                        {line.extra ? "Includes a side · " : ""}
                        {money(line.unit)} per meal
                      </small>
                    </span>
                    <strong>{money(line.quantity * line.unit)}</strong>
                  </div>
                ))}
                <dl className="track-totals">
                  <div>
                    <dt>Order total</dt>
                    <dd>{money(order.total_sen)}</dd>
                  </div>
                </dl>
                <p className="small muted">Prices reflect any deals applied when this order was placed.</p>
              </div>
            </details>
          </section>
          <p className="track-source">Live order status · Malaysia time (MYT). Updates automatically.</p>
        </aside>
      </div>
      {confirmCancel && (
        <Modal
          title="Cancel this order?"
          close={() => {
            if (!busy) setConfirmCancel(false);
          }}
        >
          <p>The stall will be notified in its kitchen board. Your pickup reservation will be released.</p>
          <ErrorMessage message={error} />
          <div className="ap-dialog-actions">
            <button className="button secondary" disabled={busy} onClick={() => setConfirmCancel(false)}>
              Keep order
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await api.cancel(id);
                  setConfirmCancel(false);
                  result.reload();
                } catch (problem) {
                  setError(messageOf(problem));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Cancelling…" : "Cancel order"}
            </button>
          </div>
        </Modal>
      )}
      {credential && order.status === "ready" && (
        <PickupDialog
          code={credential.code}
          expiresAt={Date.parse(credential.expiresAt)}
          close={() => setCredential(undefined)}
          regenerate={issue}
        />
      )}
    </>
  );
}
