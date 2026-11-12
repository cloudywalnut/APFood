"use client";

import { ArrowRight } from "lucide-react";
import { money } from "../../lib/orders";
import { useAnimatedNumber } from "./use-animated-number";

export function InsightNumber({
  value,
  moneyValue = false,
  revision,
}: {
  value: number;
  moneyValue?: boolean;
  revision: number;
}) {
  const displayed = useAnimatedNumber(value, revision > 0, 1200, undefined, revision);
  return <>{moneyValue ? money(Math.round(displayed)) : Math.round(displayed).toLocaleString("en-MY")}</>;
}

function ImpactCard({
  title,
  before,
  after,
  moneyValue,
  revision,
  lowerIsBetter = false,
}: {
  title: string;
  before: number;
  after: number;
  moneyValue?: boolean;
  revision: number;
  lowerIsBetter?: boolean;
}) {
  const delta = useAnimatedNumber(after - before, true, 1200, undefined, revision);
  const current = before + delta;
  const format = (value: number) =>
    moneyValue ? money(Math.round(value)) : value.toLocaleString("en-MY", { maximumFractionDigits: 1 });
  const finalPct = before > 0 ? ((after - before) / before) * 100 : 0;
  const pct = before > 0 ? (delta / before) * 100 : 0;
  const changeScale = Math.max(5, Math.ceil(Math.abs(finalPct) / 5) * 5);
  const improves = lowerIsBetter ? after < before : after > before;
  return (
    <article className="vendor-impact-card" data-improves={improves}>
      <header>
        <h3>{title}</h3>
        <span>
          {delta > 0 ? "+" : delta < 0 ? "−" : ""}
          {format(Math.abs(delta))}
          {before > 0 && (
            <small>
              {" "}
              ({delta > 0 ? "+" : ""}
              {((delta / before) * 100).toFixed(1)}%)
            </small>
          )}
        </span>
      </header>
      <div className="vendor-impact-values">
        <div>
          <small>Recorded</small>
          <span>{format(before)}</span>
        </div>
        <ArrowRight size={16} aria-hidden />
        <div>
          <small>FIF Optimized</small>
          <strong>{format(current)}</strong>
        </div>
      </div>
      <div className="vendor-impact-change">
        <div>
          <span>Change vs recorded</span>
          <strong>
            {pct > 0 ? "+" : ""}
            {pct.toFixed(1)}%
          </strong>
        </div>
        <div className="vendor-impact-change-track" aria-hidden="true">
          <i
            style={{
              left: `${Math.min(50, 50 + (pct / changeScale) * 50)}%`,
              width: `${(Math.abs(pct) / changeScale) * 50}%`,
            }}
          />
          <b />
        </div>
        <small>
          <span>−{changeScale}%</span>
          <span>0</span>
          <span>+{changeScale}%</span>
        </small>
      </div>
      <span className="sr-only">
        Recorded {format(before)}. Estimated {format(after)}.
      </span>
    </article>
  );
}

export function VendorInsightImpact({
  observed,
  projected,
  revision,
  actions,
}: {
  observed: { revenueSen: number; units: number; workUnits: number };
  projected: { revenueSen: number; units: number; workUnits: number };
  revision: number;
  actions: number;
}) {
  return (
    <section className="vendor-impact-preview" aria-label="Estimated impact of selected recommendations">
      <header>
        <strong>What changes with these recommendations?</strong>
        <span>{actions} selected · same reporting period</span>
      </header>
      <div className="vendor-impact-grid">
        <ImpactCard
          title="Gross revenue · RM"
          before={observed.revenueSen}
          after={projected.revenueSen}
          moneyValue
          revision={revision}
        />
        <ImpactCard title="Portions sold" before={observed.units} after={projected.units} revision={revision} />
        <ImpactCard
          title="Prep workload · work units"
          before={observed.workUnits}
          after={projected.workUnits}
          lowerIsBetter
          revision={revision}
        />
      </div>
      <p>FIF Optimized estimates. Recorded cashflow stays unchanged until orders and expenses are recorded.</p>
    </section>
  );
}
