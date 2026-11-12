"use client";

import { Check, CircleCheck, Clock3, X } from "lucide-react";
import { stages, statusNames } from "../../lib/orders";
import { trackingCopy } from "../../lib/tracking";
import type { OrderRow } from "../../lib/backend/contracts";

const descriptions: Record<(typeof stages)[number], string> = {
  placed: "Sent to the stall",
  accepted: "Confirmed by the kitchen",
  preparing: "Your food is being prepared",
  ready: "Ready at the pickup counter",
  collected: "Pickup completed",
};

const formatAt = (value: string) =>
  new Date(value).toLocaleString("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    dateStyle: "medium",
    timeStyle: "short",
  });

export function OrderTracking({ order }: { order: OrderRow }) {
  const current = stages.indexOf(order.status as (typeof stages)[number]);
  const terminal = order.status === "cancelled" || order.status === "rejected";
  const recorded: Record<string, string | null> = {
    placed: order.created_at,
    ready: order.ready_at,
    collected: order.collected_at,
  };
  return (
    <section className="panel track-progress">
      <div className="line spread">
        <h2>Order progress</h2>
        <span className="small muted">{terminal ? "Order ended" : statusNames[order.status]}</span>
      </div>
      <ol className="track-timeline">
        {stages.map((status, index) => {
          const treatment = terminal
            ? "upcoming"
            : index < current
              ? "done"
              : index === current
                ? "current"
                : "upcoming";
          const at = recorded[status];
          return (
            <li key={status} className={treatment} aria-current={index === current ? "step" : undefined}>
              <span className="track-step-mark">
                {treatment === "done" ? (
                  <Check size={16} />
                ) : treatment === "current" ? (
                  status === "collected" ? (
                    <CircleCheck size={16} />
                  ) : (
                    <Clock3 size={16} />
                  )
                ) : (
                  <span />
                )}
              </span>
              <div>
                <strong>{statusNames[status]}</strong>
                <p>{descriptions[status]}</p>
                {at && <time dateTime={at}>{formatAt(at)}</time>}
              </div>
              {treatment === "current" && <small>Now</small>}
            </li>
          );
        })}
      </ol>
      {terminal && (
        <div className="track-terminal">
          <X size={18} aria-hidden />
          <div>
            <strong>{statusNames[order.status]}</strong>
            <p>{trackingCopy[order.status].description}</p>
          </div>
        </div>
      )}
    </section>
  );
}
