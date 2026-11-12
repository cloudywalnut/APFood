type Entry = { kind: string; amount_sen: number; created_at: string };
const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
const day = (date: string) => dayFormatter.format(new Date(date));
const addDays = (date: string, count: number) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
};

export function netIncomeOutlook(
  entries: Entry[],
  since: string,
  asOf: string,
  horizon = 30,
  aiRevenueChangePct?: number,
) {
  if (![30, 60, 90, 180].includes(horizon)) {
    throw Error("Choose a supported projection horizon.");
  }
  if (aiRevenueChangePct !== undefined && !Number.isFinite(aiRevenueChangePct)) {
    throw Error("AI revenue adjustment must be finite.");
  }
  const today = day(asOf);
  const daily = new Map<string, { receiptsSen: number; costsSen: number }>();
  for (const entry of entries) {
    const key = day(entry.created_at);
    const row = daily.get(key) ?? { receiptsSen: 0, costsSen: 0 };
    if (["counter", "duitnow_qr", "demo"].includes(entry.kind)) row.receiptsSen += entry.amount_sen;
    else if (["expense", "refund"].includes(entry.kind)) row.costsSen += entry.amount_sen;
    else if (entry.kind === "reversal") row.costsSen -= entry.amount_sen;
    daily.set(key, row);
  }
  const history: { day: string; receiptsSen: number; costsSen: number; netSen: number; cumulativeSen: number }[] = [];
  let recordedSen = 0;
  for (let date = day(since); date < today; date = addDays(date, 1)) {
    const row = daily.get(date) ?? { receiptsSen: 0, costsSen: 0 };
    const netSen = row.receiptsSen - row.costsSen;
    recordedSen += netSen;
    history.push({ day: date, ...row, netSen, cumulativeSen: recordedSen });
    if (history.length > 31) throw Error("Choose at most 31 days of baseline history.");
  }
  const mean = (key: "receiptsSen" | "costsSen") =>
    history.length ? history.reduce((sum, row) => sum + row[key], 0) / history.length : 0;
  const receipts = mean("receiptsSen"),
    costs = mean("costsSen");
  let baselineSen = 0,
    scenarioSen = 0;
  const forecast = Array.from({ length: horizon }, (_, index) => {
    const baselineDailySen = Math.round(receipts) - Math.round(costs);
    const scenarioDailySen =
      Math.round(receipts * Math.max(0, 1 + (aiRevenueChangePct ?? 0) / 100)) - Math.round(costs);
    baselineSen += baselineDailySen;
    scenarioSen += scenarioDailySen;
    return {
      day: addDays(today, index),
      baselineDailySen,
      scenarioDailySen,
      baselineCumulativeSen: recordedSen + baselineSen,
      scenarioCumulativeSen: recordedSen + scenarioSen,
    };
  });
  return {
    history,
    forecast,
    recordedSen,
    baselineSen,
    scenarioSen,
    hasBaseline: history.length >= 2 && receipts > 0,
  };
}
