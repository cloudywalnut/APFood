import type { ScenarioAction, ScenarioProduct } from "../fif-scenarios";

type MenuItem = { id: string; name: string; active: boolean; stock: number };
type QueueOrder = { pickup_at: string; status: string };

// Current reserved stock has already been deducted by checkout. Do not subtract
// the queue again or treat a historical average as a guaranteed demand forecast.
export function operatingRecommendations(input: {
  menu: MenuItem[];
  products: ScenarioProduct[];
  days: number;
  queue: QueueOrder[];
  queueComplete: boolean;
  nowMs: number;
}): Omit<ScenarioAction, "id">[] {
  const actions: Omit<ScenarioAction, "id">[] = [];
  const atRisk = input.menu
    .filter((item) => item.active)
    .map((item) => {
      const sold = input.products.find((product) => product.id === item.id)?.units ?? 0;
      const perDay = sold / Math.max(1, input.days);
      return { ...item, sold, cover: perDay > 0 ? item.stock / perDay : undefined };
    })
    .filter((item) => item.stock <= 5 || (item.cover !== undefined && item.cover < 2))
    .sort((a, b) => a.stock - b.stock || a.cover! - b.cover!)[0];
  if (atRisk)
    actions.push({
      kind: "preparation",
      itemId: atRisk.id,
      title: `Review replenishment for ${atRisk.name}`,
      detail:
        "Confirm ingredients and prepare a small replenishment batch before promoting this item. Update availability only after the portions are ready.",
      evidence: [
        `${atRisk.stock} unreserved portions remain; ${atRisk.sold} units collected over ${input.days} days.`,
        atRisk.cover !== undefined
          ? `About ${atRisk.cover.toFixed(1)} days of cover at the selected period's average pace.`
          : "No measured sales pace is available.",
      ],
      assumptions: [
        "Stock cover uses historical average demand, not ingredient availability or a future sales guarantee.",
        "No revenue lift is assumed for a replenishment review.",
      ],
      volumeChangePct: 0,
      workSavingPct: 0,
    });
  if (input.queueComplete) {
    const overdue = input.queue.filter(
      (order) => order.status !== "ready" && Date.parse(order.pickup_at) < input.nowMs,
    ).length;
    const due = input.queue.filter((order) => {
      const pickup = Date.parse(order.pickup_at);
      return pickup >= input.nowMs && pickup <= input.nowMs + 3_600_000;
    }).length;
    if (overdue || due >= 8)
      actions.push({
        kind: "timing",
        title: "Prioritise the live pickup queue",
        detail:
          "Clear late preparation first, then group shared preparation steps for upcoming pickups before launching another promotion.",
        evidence: [
          `${input.queue.length} active orders; ${overdue} past pickup time and not ready; ${due} due in the next hour.`,
        ],
        assumptions: [
          "Assume a 5% preparation-effort saving from grouping shared steps; time savings have not been measured.",
          "No extra demand is assumed while clearing the queue.",
        ],
        volumeChangePct: 0,
        workSavingPct: 5,
      });
  }
  return actions;
}
