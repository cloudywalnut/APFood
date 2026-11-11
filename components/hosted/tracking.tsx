"use client";

import { Check, Clock3 } from "lucide-react";
import { stages, statusNames } from "../../lib/demo";
import type { OrderRow } from "../../lib/backend/contracts";

export function HostedTracking({ order }: { order: OrderRow }) {
  const current = stages.indexOf(order.status as typeof stages[number]);
  const terminal = order.status === "cancelled" || order.status === "rejected";
  const recorded: Record<string, string | null> = { placed: order.created_at, ready: order.ready_at, collected: order.collected_at };
  return <section className="panel track-progress"><div className="line spread"><h2>Order progress</h2><span>{statusNames[order.status]}</span></div><ol className="track-timeline">{stages.map((status, index) => {
    const treatment = terminal ? "upcoming" : index < current ? "done" : index === current ? "current" : "upcoming";
    const at = recorded[status];
    return <li key={status} className={treatment} aria-current={index === current ? "step" : undefined}><span className="track-step-mark">{treatment === "done" ? <Check size={16} /> : treatment === "current" ? <Clock3 size={16} /> : <span />}</span><div><strong>{statusNames[status]}</strong>{at && <time dateTime={at}>{new Date(at).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur", dateStyle: "medium", timeStyle: "short" })}</time>}</div></li>;
  })}</ol>{terminal && <p className="track-terminal">{statusNames[order.status]} · This order has ended.</p>}</section>;
}
