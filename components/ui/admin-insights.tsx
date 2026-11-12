"use client";
import { InfoTip } from "./info-tip";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { isActive, money, statusNames, totals, type Status } from "../../lib/orders";
type Scope = {
  vendors: { id: string; name: string }[];
  orders: { vendorId: string; status: Status }[];
  entries: {
    vendorId: string;
    type: "demo" | "counter" | "expense" | "reversal" | "duitnow_qr" | "refund";
    amount: number;
  }[];
};
const colors = ["#c89516", "#735034", "#e9c66b", "#ae7b25", "#d7b48a", "#563820", "#f4dfaa"];
export function AdminInsights({
  data,
  days,
  vendorParam = "stall",
}: {
  data: Scope;
  days: number;
  vendorParam?: string;
}) {
  const [metric, setMetric] = useState<"orders" | "net">("orders"),
    [stage, setStage] = useState<Status>(),
    [period, setPeriod] = useState<"active" | "all">("active");
  const orders = data.orders.filter((o) => period === "all" || isActive(o.status));
  const statuses: Status[] =
    period === "active"
      ? ["placed", "accepted", "preparing", "ready"]
      : ["placed", "accepted", "preparing", "ready", "collected", "cancelled", "rejected"];
  const counts = statuses.map((s) => orders.filter((o) => o.status === s).length),
    total = orders.length;
  let offset = 0;
  const gradient = counts
    .map((n, i) => {
      const start = offset;
      offset += total ? (n / total) * 100 : 0;
      return colors[i] + " " + start + "% " + offset + "%";
    })
    .join(",");
  const breakdown = data.vendors.map((v) => ({
    vendor: v,
    count: orders.filter((o) => o.vendorId === v.id && (!stage || o.status === stage)).length,
    net: totals(data.entries.filter((e) => e.vendorId === v.id)).net,
  }));
  const max = Math.max(1, ...breakdown.map((row) => (metric === "orders" ? row.count : Math.abs(row.net))));
  return (
    <div className="admin-insights-grid">
      <section className="panel insight-distribution">
        <div className="line spread wrap">
          <div>
            <p className="caf-eyebrow">ORDER FLOW</p>
            <h2>
              What’s happening in the kitchens?
              <InfoTip label="Order flow" text="Select a status to filter the stall comparison." />
            </h2>
          </div>
          <div className="segmented">
            <button
              aria-pressed={period === "active"}
              onClick={() => {
                setPeriod("active");
                setStage(undefined);
              }}
            >
              Active
            </button>
            <button
              aria-pressed={period === "all"}
              onClick={() => {
                setPeriod("all");
                setStage(undefined);
              }}
            >
              All orders
            </button>
          </div>
        </div>
        <div className="insight-ring-layout">
          <div
            className="insight-ring"
            style={{ background: total ? "conic-gradient(" + gradient + ")" : "#eee6d5" }}
            role="img"
            aria-label={
              total +
              " " +
              (period === "active" ? "active" : "total") +
              " orders. " +
              statuses.map((s, i) => statusNames[s] + ": " + counts[i]).join(", ")
            }
          >
            <div>
              <strong>{total}</strong>
              <small>{period === "active" ? "active orders" : "total orders"}</small>
            </div>
          </div>
          <div className="insight-stage-list">
            {statuses.map((status, i) => (
              <button
                key={status}
                aria-pressed={stage === status}
                onClick={() => {
                  setStage(stage === status ? undefined : status);
                  setMetric("orders");
                }}
              >
                <i style={{ background: colors[i] }} />
                <span>{statusNames[status]}</span>
                <strong>{counts[i]}</strong>
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="panel insight-stalls">
        <div className="line spread wrap">
          <div>
            <p className="caf-eyebrow">STALL COMPARISON</p>
            <h2>{stage ? statusNames[stage] + " orders by stall" : "How are the stalls doing?"}</h2>
          </div>
          <div className="segmented">
            <button aria-pressed={metric === "orders"} onClick={() => setMetric("orders")}>
              Orders
            </button>
            <button
              aria-pressed={metric === "net"}
              onClick={() => {
                setMetric("net");
                setStage(undefined);
              }}
            >
              Net flow
            </button>
          </div>
        </div>
        <div className="insight-comparison">
          {breakdown.map((row, i) => (
            <Link href={"/admin/products?" + vendorParam + "=" + row.vendor.id + "&days=" + days} key={row.vendor.id}>
              <div>
                <span>{row.vendor.name}</span>
                <strong>{metric === "orders" ? row.count : money(row.net)}</strong>
                <ArrowUpRight size={13} />
              </div>
              <div className="insight-bar">
                <span
                  style={{
                    width: Math.max(0, ((metric === "orders" ? row.count : Math.abs(row.net)) / max) * 100) + "%",
                    background: metric === "net" && row.net < 0 ? "#735034" : colors[i % colors.length],
                  }}
                />
              </div>
            </Link>
          ))}
        </div>
        {stage && (
          <button className="quiet-link" onClick={() => setStage(undefined)}>
            Clear status selection ×
          </button>
        )}
        <p className="small muted">
          Choose a stall to explore its products. Net flow includes receipts, expenses and reversals.
        </p>
      </section>
    </div>
  );
}
