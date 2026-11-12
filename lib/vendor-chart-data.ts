type Finance = {
  demo: number;
  counter: number;
  duitnow_qr: number;
  expense: number;
  refund: number;
  reversal: number;
  netSen: number;
};

export function cashflowBridge(finance: Finance) {
  const receipts = finance.demo + finance.counter + finance.duitnow_qr;
  const afterExpenses = receipts - finance.expense;
  const afterRefunds = afterExpenses - finance.refund;
  const net = afterRefunds + finance.reversal;
  return {
    receipts,
    net,
    reconciled: net === finance.netSen,
    steps: [
      { label: "Receipts", start: 0, end: receipts, value: receipts, total: false },
      {
        label: "Expenses",
        start: receipts,
        end: afterExpenses,
        value: finance.expense ? -finance.expense : 0,
        total: false,
      },
      {
        label: "Refunds",
        start: afterExpenses,
        end: afterRefunds,
        value: finance.refund ? -finance.refund : 0,
        total: false,
      },
      { label: "Reversals", start: afterRefunds, end: net, value: finance.reversal, total: false },
      { label: "Net flow", start: 0, end: net, value: net, total: true },
    ],
  };
}

export type ProductMeasure = "revenue" | "units";
type ProductSales = { id: string; name: string; units: number; fulfilledValueSen: number };

export function productDrivers<T extends ProductSales>(products: T[], measure: ProductMeasure) {
  const value = (product: T) => (measure === "revenue" ? product.fulfilledValueSen : product.units);
  const selling = products.filter((product) => value(product) > 0);
  const total = selling.reduce((sum, product) => sum + value(product), 0);
  return {
    total,
    ranked: [...selling].sort((a, b) => value(b) - value(a) || a.name.localeCompare(b.name)),
    value,
  };
}
