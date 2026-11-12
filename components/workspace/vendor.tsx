"use client";

import { VendorInsights } from "../hosted/vendor-insights";
import { KitchenBoard } from "../hosted/kitchen-board";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, ImagePlus, Package, Pause, Play, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { canCancelOrder, money } from "../../lib/orders";
import { apiClient } from "../../lib/backend/client";
import { isValidImageSrc, type OrderRow } from "../../lib/backend/contracts";
import { subscribeToOrders } from "../../lib/backend/realtime";
import { pickupWindow } from "../../lib/pickup-time";
import { mealPhoto } from "../storefront/catalogue";
import { Empty, ErrorMessage, Modal, OpsShell, StatusBadge, replaceFilters } from "../shared";
import { WorkspaceAccess, RemoteStatus, messageOf, useApi, useRemote, type Session } from "./common";
import { OrderPayment, VendorPaymentSettings } from "./payments";

type Stall = Awaited<ReturnType<typeof apiClient.assignedStalls>>[number];
type MenuItem = Awaited<ReturnType<typeof apiClient.vendorMenu>>[number];
const stages = [
  { status: "placed", label: "New", next: "accepted", action: "Accept order" },
  { status: "accepted", label: "Accepted", next: "preparing", action: "Start preparing" },
  { status: "preparing", label: "Preparing", next: "ready", action: "Mark ready" },
  { status: "ready", label: "Ready", next: "collected", action: "Verify pickup" },
] as const;

export function VendorWorkspace({ route, section, id }: { route: string; section: string; id?: string }) {
  return (
    <WorkspaceAccess role="vendor">
      {(session) => (
        <OpsShell kind="vendor" route={route} title="Vendor workspace">
          <VendorContent session={session} section={section} id={id} />
        </OpsShell>
      )}
    </WorkspaceAccess>
  );
}

function VendorContent({ session, section, id }: { session: Session; section: string; id?: string }) {
  const selection = useSearchParams().get("stall");
  const api = useApi();
  const stalls = useRemote(api.assignedStalls);
  useEffect(() => {
    const onActionApplied = () => {
      stalls.reload();
    };
    window.addEventListener("apfood:vendor-action-applied", onActionApplied);
    return () => window.removeEventListener("apfood:vendor-action-applied", onActionApplied);
  }, [stalls.reload]);
  if (id) return <VendorOrder key={id} id={id} session={session} />;
  if (!stalls.value) return <RemoteStatus error={stalls.error} reload={stalls.reload} />;
  const stall = stalls.value.find((entry) => entry.id === selection) ?? stalls.value[0];
  if (!stall)
    return <Empty title="No assigned stalls" detail="Ask an administrator to check your vendor membership." />;
  const titles: Record<string, string> = {
    home: "Stall overview",
    orders: "Kitchen board",
    menu: "Menu & stock",
    insights: "AI Insights",
    payments: "Payment settings",
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{titles[section] ?? "Shift dashboard"}</h1>
          {section !== "home" && <p>{stall.name}</p>}
        </div>
        {stalls.value.length > 1 && (
          <div className="line wrap">
            <label className="field compact">
              Stall
              <select value={stall.id} onChange={(event) => replaceFilters({ stall: event.target.value })}>
                {stalls.value.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>
      {(section === "home" || section === "orders" || section === "insights") && (
        <Kitchen
          key={stall.id + section}
          stall={stall}
          summary={section !== "orders"}
          detailed={section === "insights"}
        />
      )}
      {section === "insights" && <Settings key={stall.id + ":settings"} stall={stall} reload={stalls.reload} />}
      {section === "menu" && <VendorMenu key={stall.id} stall={stall} />}
      {section === "payments" && <VendorPaymentSettings key={stall.id} vendorId={stall.id} />}
    </>
  );
}

function Kitchen({ stall, summary, detailed = false }: { stall: Stall; summary: boolean; detailed?: boolean }) {
  const api = useApi();
  const load = useCallback(() => api.kitchen(stall.id), [stall.id, api]);
  const orders = useRemote(load);
  useEffect(() => subscribeToOrders({ vendorId: stall.id }, orders.reload), [stall.id, orders.reload]);
  if (!orders.value) return <RemoteStatus error={orders.error} reload={orders.reload} />;
  const active = orders.value.filter(
    (order) =>
      stages.some((stage) => stage.status === order.status) &&
      (order.payment !== "duitnow_qr" || order.payment_record?.status === "paid"),
  );
  return summary ? (
    <VendorInsights vendorId={stall.id} active={active} orders={orders.value} detailed={detailed} />
  ) : (
    <KitchenBoard orders={orders.value} refresh={orders.reload} />
  );
}

function VendorOrder({ id, session }: { id: string; session: Session }) {
  const api = useApi();
  const load = useCallback(() => api.order(id), [id, api]);
  const result = useRemote(load);
  const order = result.value;
  const stall =
    order &&
    session.memberships.find((entry) => entry.role === "vendor" && entry.vendor_id === order.vendor_id)?.vendor_id;
  useEffect(() => {
    if (stall) return subscribeToOrders({ vendorId: stall }, result.reload);
  }, [stall, result.reload]);
  if (!order) return <RemoteStatus error={result.error} reload={result.reload} />;
  if (!stall)
    return (
      <Empty
        title="Order unavailable"
        detail="Choose an order from your assigned stall."
        href="/vendor/orders"
        action="Kitchen board"
      />
    );
  return <VendorOrderActions order={order} reload={result.reload} />;
}

function VendorOrderActions({ order, reload }: { order: OrderRow; reload: () => void }) {
  const api = useApi();
  const [mode, setMode] = useState<"collect" | "cancel" | "reject">();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const stage = stages.find((entry) => entry.status === order.status);
  const next = stage?.next;
  async function act(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
      setMode(undefined);
    } catch (problem) {
      setError(messageOf(problem));
    } finally {
      reload();
      setBusy(false);
    }
  }
  function open(value: NonNullable<typeof mode>) {
    setError("");
    setMode(value);
  }
  const title = mode === "collect" ? "Verify pickup" : mode === "reject" ? "Reject order" : "Cancel order";
  return (
    <>
      <Link className="quiet-link back-link" href={"/vendor/orders?stall=" + encodeURIComponent(order.vendor_id)}>
        Back to kitchen
      </Link>
      <div className="page-heading">
        <div>
          <h1>Order {order.id.slice(0, 8)}</h1>
          <p>{pickupWindow(order.pickup_at)}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>
      {order.payment === "duitnow_qr" && (
        <OrderPayment id={order.id} total={order.total_sen} version={order.version} changed={reload} />
      )}
      <section className="panel order-summary">
        <h2>Order details</h2>
        {order.lines.map((line) => (
          <div className="line spread" key={line.itemId + line.extra}>
            <span>
              {line.quantity} × {line.name}
              {line.extra && " + side"}
            </span>
            <strong>{money(line.quantity * line.unit)}</strong>
          </div>
        ))}
        <div className="line spread cart-total">
          <strong>
            {order.payment === "counter" ? "Pay at counter" : order.payment === "duitnow_qr" ? "DuitNow QR" : "Payment"}
          </strong>
          <strong>{money(order.total_sen)}</strong>
        </div>
        <div className="line wrap">
          {next && (
            <button
              className="button primary"
              disabled={busy || (order.payment === "duitnow_qr" && order.payment_record?.status !== "paid")}
              onClick={() => (next === "collected" ? open("collect") : void act(() => api.transition(order.id, next)))}
            >
              {stage.action}
            </button>
          )}
          {order.status === "placed" && (
            <button className="button secondary" disabled={busy} onClick={() => open("reject")}>
              Reject order
            </button>
          )}
          {canCancelOrder(order.status) && (
            <button className="button secondary" disabled={busy} onClick={() => open("cancel")}>
              Cancel order
            </button>
          )}
        </div>
        {!mode && <ErrorMessage message={error} />}
      </section>
      {mode && (
        <Modal
          title={title}
          close={() => {
            if (!busy) setMode(undefined);
          }}
        >
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const reason = String(data.get("reason") ?? "");
              void act(() =>
                mode === "collect"
                  ? api.collect(order.id, String(data.get("code")), data.get("counter") === "on")
                  : mode === "reject"
                    ? api.transition(order.id, "rejected", reason)
                    : api.cancel(order.id, reason),
              );
            }}
          >
            {mode === "collect" ? (
              <>
                <label className="field">
                  Pickup code
                    <input
                      name="code"
                      required
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="8-digit pickup code"
                      minLength={8}
                      maxLength={32}
                      pattern="[0-9]{8}|[a-fA-F0-9]{32}"
                    />
                </label>
                {order.payment === "counter" && (
                  <label className="check">
                    <input name="counter" type="checkbox" required /> Confirm counter payment · {money(order.total_sen)}
                  </label>
                )}
              </>
            ) : (
              <label className="field">
                Reason
                <textarea name="reason" required maxLength={250} />
              </label>
            )}
            <ErrorMessage message={error} />
            <button className="button primary" disabled={busy}>
              {busy ? "Updating…" : mode === "collect" ? "Mark collected" : title}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}

function DishThumb({ src, alt, size = 52 }: { src?: string; alt: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [src]);
  if (!src || !isValidImageSrc(src) || broken) return <UtensilsCrossed size={Math.round(size * 0.4)} aria-hidden />;
  return <Image src={src} alt={alt} width={size} height={size} unoptimized onError={() => setBroken(true)} />;
}

function VendorMenu({ stall }: { stall: Stall }) {
  const api = useApi();
  const load = useCallback(() => api.vendorMenu(stall.id), [stall.id, api]);
  const result = useRemote(load);
  useEffect(() => {
    const onActionApplied = () => {
      result.reload();
    };
    window.addEventListener("apfood:vendor-action-applied", onActionApplied);
    return () => window.removeEventListener("apfood:vendor-action-applied", onActionApplied);
  }, [result.reload]);
  const [edit, setEdit] = useState<MenuItem | null>();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "published" | "hidden" | "low">("all");
  const [quickBusy, setQuickBusy] = useState<{ id: string; action: "stock" | "active" } | null>(null);
  const [quickError, setQuickError] = useState("");
  if (!result.value) return <RemoteStatus error={result.error} reload={result.reload} />;
  const items = result.value;
  const publishedCount = items.filter((item) => item.active).length;
  const lowStockCount = items.filter((item) => item.stock <= 5).length;
  const visible = items.filter((item) => {
    const matchesSearch = (item.name + " " + item.description).toLowerCase().includes(search.trim().toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "published" && item.active) ||
      (filter === "hidden" && !item.active) ||
      (filter === "low" && item.stock <= 5);
    return matchesSearch && matchesFilter;
  });

  async function quickUpdate(item: MenuItem, action: "stock" | "active", patch: { stock?: number; active?: boolean }) {
    if (quickBusy) return;
    setQuickBusy({ id: item.id, action });
    setQuickError("");
    try {
      await api.saveMenu({
        id: item.id,
        vendorId: stall.id,
        name: item.name,
        description: item.description,
        priceSen: item.price_sen,
        stock: patch.stock ?? item.stock,
        expectedStock: item.stock,
        active: patch.active ?? item.active,
        workUnits: item.work_units,
        image: item.image || undefined,
      });
    } catch (problem) {
      setQuickError(messageOf(problem));
    } finally {
      result.reload();
      setQuickBusy(null);
    }
  }

  return (
    <>
      <div className="metrics vendor-metrics">
        <section className="metric">
          <div>
            <span>Total dishes</span>
            <strong>{items.length}</strong>
          </div>
          <span className="metric-icon">
            <UtensilsCrossed size={19} aria-hidden />
          </span>
        </section>
        <section className="metric">
          <div>
            <span>Published</span>
            <strong>{publishedCount}</strong>
          </div>
          <span className="metric-icon green">
            <Eye size={19} aria-hidden />
          </span>
        </section>
        <section className="metric">
          <div>
            <span>Low or out of stock</span>
            <strong>{lowStockCount}</strong>
          </div>
          <span className="metric-icon amber">
            <Package size={19} aria-hidden />
          </span>
        </section>
      </div>
      <section className="panel">
        <div className="line spread wrap">
          <div>
            <h2>Menu items</h2>
            <p className="muted small">Manage dish photos, pricing, stock, and availability for students.</p>
          </div>
          <button className="button primary" onClick={() => setEdit(null)}>
            <Plus size={17} aria-hidden />
            Add item
          </button>
        </div>
        <div className="menu-toolbar">
          <label className="field">
            Search menu
            <input
              type="search"
              placeholder="Search by dish name or description"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="segmented" role="group" aria-label="Menu filter">
            {(
              [
                ["all", "All"],
                ["published", "Published"],
                ["hidden", "Hidden"],
                ["low", "Low stock"],
              ] as const
            ).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <ErrorMessage message={quickError} />
        {visible.length ? (
          <div className="table-wrap">
            <table className="table-stack">
              <thead>
                <tr>
                  <th>Dish</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Visibility</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => {
                  const photo = mealPhoto(item);
                  const finalPrice = item.price_sen - item.discount_sen;
                  const stockBusy = quickBusy?.id === item.id && quickBusy.action === "stock";
                  const activeBusy = quickBusy?.id === item.id && quickBusy.action === "active";
                  const anyBusy = Boolean(quickBusy);
                  const nextStock = Math.min(1_000_000, item.stock + 5);
                  return (
                    <tr key={item.id}>
                      <th scope="row">
                        <div className="menu-item-cell">
                          <div className="menu-item-thumb">
                            <DishThumb src={photo} alt={item.name} />
                          </div>
                          <div className="menu-item-meta">
                            <strong>{item.name}</strong>
                            {item.description ? <small>{item.description}</small> : <small>No description</small>}
                          </div>
                        </div>
                      </th>
                      <td data-label="Price">
                        <strong>{money(finalPrice)}</strong>
                        {item.discount_sen > 0 && <del className="menu-price-del">{money(item.price_sen)}</del>}
                      </td>
                      <td data-label="Stock">
                        <div className="menu-stock-cell">
                          <span>{item.stock}</span>
                          {item.stock === 0 ? (
                            <span className="badge warn">Out of stock</span>
                          ) : item.stock <= 5 ? (
                            <span className="badge neutral">Low</span>
                          ) : null}
                        </div>
                      </td>
                      <td data-label="Visibility">
                        <span className={"badge " + (item.active ? "good" : "neutral")}>
                          {item.active ? "Published" : "Hidden"}
                        </span>
                      </td>
                      <td className="table-stack-action">
                        <div className="menu-row-actions">
                          <button
                            type="button"
                            className="button secondary menu-quick-btn"
                            disabled={anyBusy || item.stock >= 1_000_000}
                            aria-label={`Add 5 stock to ${item.name}`}
                            onClick={() => void quickUpdate(item, "stock", { stock: nextStock })}
                          >
                            <Plus size={14} aria-hidden />
                            {stockBusy ? "Saving…" : "5 stock"}
                          </button>
                          <button
                            type="button"
                            className={"button secondary menu-quick-btn" + (item.active ? "" : " is-resume")}
                            disabled={anyBusy}
                            aria-label={`${item.active ? "Pause" : "Resume"} ${item.name}`}
                            onClick={() => void quickUpdate(item, "active", { active: !item.active })}
                          >
                            {item.active ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}
                            {activeBusy ? (item.active ? "Pausing…" : "Resuming…") : item.active ? "Pause" : "Resume"}
                          </button>
                          <button
                            type="button"
                            className="button secondary menu-quick-btn"
                            disabled={anyBusy}
                            onClick={() => setEdit(item)}
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="menu-empty-state">
            <UtensilsCrossed size={24} aria-hidden />
            <p>
              {items.length
                ? "No menu items match your search or filter."
                : "No dishes added yet. Add your first menu item to start taking orders."}
            </p>
            {items.length ? (
              <button
                className="button secondary"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
              >
                Reset filters
              </button>
            ) : (
              <button className="button primary" onClick={() => setEdit(null)}>
                <Plus size={17} aria-hidden />
                Add first item
              </button>
            )}
          </div>
        )}
        {edit !== undefined && (
          <EditItem
            item={edit}
            stall={stall}
            close={() => setEdit(undefined)}
            saved={() => {
              setEdit(undefined);
              result.reload();
            }}
          />
        )}
      </section>
    </>
  );
}

function EditItem({
  item,
  stall,
  close,
  saved,
}: {
  item: MenuItem | null;
  stall: Stall;
  close: () => void;
  saved: () => void;
}) {
  const api = useApi();
  const [id] = useState(() => item?.id ?? crypto.randomUUID());
  const [imageUrl, setImageUrl] = useState(() => item?.image || (item ? (mealPhoto(item) ?? "") : ""));
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setUploadError("Choose a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError("Image must be 2 MB or smaller.");
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("image", file);
      const result = await api.uploadMenuImage(stall.id, formData);
      setImageUrl(result.url);
    } catch (problem) {
      setUploadError(messageOf(problem));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal
      title={item ? "Edit menu item" : "Add menu item"}
      close={() => {
        if (!busy && !uploading) close();
      }}
    >
      <form
        className="stack"
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const name = String(data.get("name") ?? "").trim();
          const trimmedImage = imageUrl.trim();
          if (!name) {
            setError("Enter a dish name.");
            return;
          }
          if (trimmedImage && !isValidImageSrc(trimmedImage)) {
            setError("Enter an image URL starting with https://, http://, or /.");
            return;
          }
          const rawUnits = String(data.get("units") ?? "").trim();
          const workUnits = rawUnits === "" ? undefined : Number(rawUnits);
          setBusy(true);
          setError("");
          try {
            await api.saveMenu({
              id,
              vendorId: stall.id,
              name,
              description: String(data.get("description") ?? "").trim(),
              priceSen: Math.round(Number(data.get("price")) * 100),
              stock: Number(data.get("stock")),
              expectedStock: item?.stock ?? null,
              active: data.get("active") === "on",
              workUnits,
              image: trimmedImage,
            });
            saved();
          } catch (problem) {
            setError(messageOf(problem));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="menu-photo-editor">
          <div className="menu-photo-preview">
            <DishThumb src={imageUrl.trim() || undefined} alt="Dish preview" size={92} />
          </div>
          <div className="menu-photo-controls">
            <div className="menu-photo-actions">
              <label className="button secondary menu-upload-label">
                <ImagePlus size={16} aria-hidden />
                {uploading ? "Uploading…" : "Upload photo"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={uploading || busy}
                  onChange={handleFileChange}
                />
              </label>
              {imageUrl.trim() && (
                <button
                  type="button"
                  className="button secondary"
                  disabled={uploading || busy}
                  onClick={() => {
                    setImageUrl("");
                    setUploadError("");
                  }}
                >
                  <Trash2 size={15} aria-hidden />
                  Remove
                </button>
              )}
            </div>
            <label className="field">
              Image URL (optional)
              <input
                type="text"
                placeholder="https://... or /food/noodles.webp"
                maxLength={500}
                value={imageUrl}
                onChange={(event) => {
                  setImageUrl(event.target.value);
                  setUploadError("");
                }}
              />
            </label>
            <span className="field-hint">PNG, JPEG, or WebP up to 2 MB, or paste an image URL.</span>
            <ErrorMessage message={uploadError} />
          </div>
        </div>
        <label className="field">
          Name
          <input name="name" required maxLength={70} placeholder="e.g. Chicken Rice Bowl" defaultValue={item?.name} />
        </label>
        <label className="field">
          Description
          <textarea
            name="description"
            maxLength={140}
            placeholder="Short description shown on the student menu"
            defaultValue={item?.description}
          />
        </label>
        <div className="menu-form-row">
          <label className="field">
            Regular price (RM)
            <input
              name="price"
              type="number"
              min=".01"
              max="1000"
              step=".01"
              required
              defaultValue={item ? (item.price_sen / 100).toFixed(2) : undefined}
            />
          </label>
          <label className="field">
            Stock
            <input name="stock" type="number" min="0" max="1000000" required defaultValue={item?.stock ?? 0} />
          </label>
        </div>
        <label className="field">
          Prep work units (optional)
          <input
            name="units"
            type="number"
            min="1"
            max="300"
            placeholder="Defaults to 1"
            defaultValue={item?.work_units ?? ""}
          />
          <span className="field-hint">
            Capacity units per order; leave blank for standard or cooked-to-order items.
          </span>
        </label>
        <label className="check">
          <input name="active" type="checkbox" defaultChecked={item?.active ?? true} /> Publish item on student menu
        </label>
        <ErrorMessage message={error} />
        <button className="button primary" disabled={busy || uploading}>
          {busy ? "Saving…" : "Save item"}
        </button>
      </form>
    </Modal>
  );
}

function Settings({ stall, reload }: { stall: Stall; reload: () => void }) {
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  return (
    <section className="panel">
      <h2>Pickup settings</h2>
      <form
        className="stack"
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setBusy(true);
          setError("");
          setNotice("");
          try {
            await api.settings(stall.id, {
              capacity: Number(data.get("capacity")),
              leadMinutes: Number(data.get("lead")),
              opensAt: String(data.get("opens")),
              closesAt: String(data.get("closes")),
              paused: data.get("paused") === "on",
            });
            reload();
            setNotice("Pickup settings saved.");
          } catch (problem) {
            setError(messageOf(problem));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          Opens (MYT)
          <input name="opens" required pattern="[0-9]{2}:[0-9]{2}" defaultValue={stall.opens_at.slice(0, 5)} />
        </label>
        <label className="field">
          Closes (MYT)
          <input name="closes" required pattern="[0-9]{2}:[0-9]{2}" defaultValue={stall.closes_at.slice(0, 5)} />
        </label>
        <label className="field">
          Work units per 15 minutes
          <input name="capacity" type="number" min="1" max="300" required defaultValue={stall.capacity} />
        </label>
        <label className="field">
          Prep lead time (minutes)
          <input name="lead" type="number" min="1" max="120" required defaultValue={stall.lead_minutes} />
        </label>
        <label className="check">
          <input name="paused" type="checkbox" defaultChecked={stall.paused} /> Pause intake
        </label>
        <ErrorMessage message={error} />
        {notice && (
          <p className="success" role="status">
            {notice}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          Save pickup settings
        </button>
      </form>
    </section>
  );
}
