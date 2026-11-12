export type Role = "student" | "vendor" | "admin";
export type ReportKind = "orders" | "finance" | "stock";
export type ReportData = {
  title: string;
  generatedAt: string;
  timezone: string;
  source: string;
  scope?: { kind: ReportKind; period: string; zone: string; stall: string };
  summary?: { label: string; value: string }[];
  sections?: { title: string; paragraphs: string[] }[];
  columns: string[];
  rows: string[][];
};
export type Preferences = { density: "comfortable" | "compact"; localTimezone: boolean; inAppUpdates: boolean };
