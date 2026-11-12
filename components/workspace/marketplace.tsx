"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock3 } from "lucide-react";
import { apiClient } from "../../lib/backend/client";
import { isActive, money, stages, statusNames } from "../../lib/orders";
import { sampleLayout } from "../../lib/cafeteria/layout";
import { pickupWindow } from "../../lib/pickup-time";
import { mealPhoto, type Meal, type Stall } from "../storefront/catalogue";
import { Marketplace } from "../storefront/marketplace";
import { RemoteStatus, useApi, useRemote } from "./common";
import { subscribeToOrders } from "../../lib/backend/realtime";

export function CampusMarketplace({
  signedIn = false,
  userId,
  areaId,
  map = false,
}: {
  signedIn?: boolean;
  userId?: string;
  areaId?: string;
  map?: boolean;
}) {
  const catalogue = useRemote(apiClient.catalogue);
  const traffic = useRemote(apiClient.traffic);
  if (!catalogue.value) return <RemoteStatus error={catalogue.error} reload={catalogue.reload} />;
  return (
    <Marketplace
      data={catalogue.value}
      buckets={traffic.value?.buckets}
      areaId={areaId}
      initialView={map || areaId ? "map" : "list"}
      activeOrder={userId ? <ActivePickup userId={userId} vendors={catalogue.value.vendors} /> : undefined}
      recommendation={
        signedIn ? undefined : (
          <div className="market-guest-pickup">
            <div>
              <span>YOUR CAMPUS ACCOUNT</span>
              <strong>Browse now. Log in when you’re ready.</strong>
              <p>
                Save your basket across devices, place an order and track your pickup. Personal recommendations are
                available after sign-in.
              </p>
            </div>
            <Link className="button primary" href="/auth/login?next=%2Fapp">
              Log in
              <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        )
      }
    />
  );
}

const activeStages = stages.slice(0, 4);

function ActivePickup({ userId, vendors }: { userId: string; vendors: Stall[] }) {
  const api = useApi();
  const orders = useRemote(api.orders);
  useEffect(() => subscribeToOrders({ studentId: userId }, orders.reload), [userId, orders.reload]);
  const activeOrders = orders.value?.filter((row) => isActive(row.status)) ?? [];
  const order = activeOrders[0];
  if (!order) return null;
  const vendor = vendors.find((entry) => entry.id === order.vendor_id);
  const firstLine = order.lines[0];
  const dishSrc =
    (firstLine ? mealPhoto({ id: firstLine.itemId } as Meal) : undefined) ??
    sampleLayout.locations.find((loc) => loc.stallId === order.vendor_id)?.photo ??
    (vendor ? "/food/" + vendor.image + ".webp" : "/food/lunch.webp");
  const stageIndex = Math.max(0, activeStages.indexOf(order.status as (typeof activeStages)[number]));
  const percent = Math.round(((stageIndex + 1) / activeStages.length) * 100);
  const summary = firstLine
    ? `${firstLine.quantity} × ${firstLine.name}${order.lines.length > 1 ? ` + ${order.lines.length - 1} more` : ""}`
    : "Campus order";
  return (
    <Link
      href={"/app/orders/" + order.id}
      className={"market-active-order" + (order.status === "ready" ? " is-ready" : "")}
      aria-label={"Track active order from " + (vendor?.name ?? order.vendor_id)}
    >
      <div className="market-active-photo">
        <Image src={dishSrc} alt={firstLine?.name ?? vendor?.name ?? "Order dish"} fill sizes="80px" />
      </div>
      <div className="market-active-body">
        <div className="market-active-meta">
          <img className="market-active-logo" src="/brand/ap-monogram-v2.png" alt="" width="20" height="20" />
          <span>{order.status === "ready" ? "Ready for pickup" : "Current order"}</span>
          <span aria-hidden>·</span>
          <span>{vendor?.name ?? order.vendor_id}</span>
          {activeOrders.length > 1 && (
            <>
              <span aria-hidden>·</span>
              <span>+{activeOrders.length - 1} more</span>
            </>
          )}
        </div>
        <div className="market-active-title">
          <strong>{summary}</strong>
          <span>
            <Clock3 size={13} aria-hidden />
            {pickupWindow(order.pickup_at)}
          </span>
        </div>
        <div className="market-active-progress" aria-label={`Order progress: ${statusNames[order.status]}`}>
          <div
            className="market-active-segments"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            {activeStages.map((stage, index) => (
              <span key={stage} className={index <= stageIndex ? "is-filled" : ""} />
            ))}
          </div>
          <div className="market-active-steps">
            {activeStages.map((stage, index) => (
              <span key={stage} className={index < stageIndex ? "is-done" : index === stageIndex ? "is-current" : ""}>
                {statusNames[stage]}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="market-active-side">
        <strong className="market-active-price">{money(order.total_sen)}</strong>
        <span className="market-active-cta">
          Track order
          <ArrowRight size={15} aria-hidden />
        </span>
      </div>
    </Link>
  );
}
