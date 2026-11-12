const { test } = require("node:test");
const assert = require("node:assert/strict");
const { trackingCopy, canStudentCancel, canShowPickup } = require("../.test-build/lib/tracking");
const { reportCsv, reportPdf } = require("../.test-build/lib/report-export");

test("student cancellation and pickup code eligibility preserve existing state machine", () => {
  for (const status of Object.keys(trackingCopy)) {
    assert.equal(canStudentCancel(status), ["placed", "accepted"].includes(status));
    assert.equal(canShowPickup(status), status === "ready");
  }
});

test("CSV is a consistent table with metadata, escaping and spreadsheet formula protection", () => {
  const report = {
    title: "APFoods test",
    generatedAt: "2026-11-11T00:00:00Z",
    timezone: "Asia/Kuala_Lumpur",
    source: "Sample",
    columns: ["Name", "Note"],
    rows: [["=1+1", 'He said "hello", then left']],
  };
  const csv = reportCsv(report);
  assert.ok(csv.startsWith('\uFEFF"Report","Generated"'));
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('"He said ""hello"", then left"'));
  assert.equal(csv.split("\r\n").length, 2);
});

test("styled PDF has cover, contents, summary, paginated tables and valid xref", () => {
  const rows = Array.from({ length: 160 }, (_, index) => [
    "AP-" + (1000 + index),
    "Indian",
    "12:15 PM",
    "collected",
    "RM 12.00",
  ]);
  const report = {
    title: "APFoods orders report",
    generatedAt: "2026-11-11T00:00:00Z",
    timezone: "Asia/Kuala_Lumpur",
    source: "Supabase · Demo data",
    columns: ["Order", "Stall", "Pickup", "Status", "Value"],
    rows,
    summary: [{ label: "Orders", value: String(rows.length) }],
  };
  const pdf = Buffer.from(reportPdf(report)).toString();
  assert.ok(pdf.startsWith("%PDF-1.4"));
  assert.ok(pdf.includes("Contents & overview"));
  assert.ok(pdf.includes("Detailed records"));
  assert.ok(pdf.includes("/BaseFont /Helvetica-Bold"));
  const xref = Number(pdf.match(/startxref\n(\d+)/)[1]);
  assert.equal(pdf.slice(xref, xref + 4), "xref");
  assert.ok(Number(pdf.match(/\/Type \/Pages \/Count (\d+)/)[1]) > 3);
});
