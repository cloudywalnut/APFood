"use client";
import { useRef, useState } from "react";
import { apiClient, ApiError } from "../../lib/backend/client";
import { ErrorMessage, Modal } from "../shared";
import { messageOf, useApi } from "../workspace/common";
import { money } from "../../lib/orders";
type Report = Awaited<ReturnType<typeof apiClient.report>>;
type Vendor = Report["vendors"][number];
type LedgerEntry = Report["ledger"][number];
export function ManageVendor({
  vendor,
  zones,
  close,
  saved,
}: {
  vendor: Pick<Vendor, "id" | "name" | "status" | "zone_id">;
  zones: { id: string; name: string }[];
  close: () => void;
  saved: () => void;
}) {
  const api = useApi();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={"Manage " + vendor.name}
      close={() => {
        if (!busy) close();
      }}
    >
      <form
        className="stack"
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setBusy(true);
          setError("");
          try {
            await api.manageStall(vendor.id, {
              status: data.get("status") === "suspended" ? "suspended" : "approved",
              zoneId: String(data.get("zone")),
              reason: String(data.get("reason")),
            });
            saved();
          } catch (problem) {
            setError(messageOf(problem));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          Approval
          <select name="status" defaultValue={vendor.status}>
            <option value="approved">Approved</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
        <label className="field">
          Food court
          <select name="zone" defaultValue={vendor.zone_id}>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Reason
          <textarea name="reason" maxLength={250} required />
        </label>
        <ErrorMessage message={error} />
        <button className="button primary" disabled={busy}>
          Save vendor changes
        </button>
      </form>
    </Modal>
  );
}

export function ExpenseForm({
  entry,
  stalls,
  defaultStall,
  close,
  saved,
}: {
  entry: LedgerEntry | null;
  stalls: { id: string; name: string }[];
  defaultStall?: string;
  close: () => void;
  saved: () => void;
}) {
  const api = useApi();
  const attempt = useRef<Parameters<typeof apiClient.expense>[0]>(undefined);
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal
      title={entry ? "Reverse expense" : "Record expense"}
      close={() => {
        if (!busy && !pending) close();
      }}
    >
      <form
        className="stack"
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setBusy(true);
          setError("");
          try {
            if (entry) await api.reverseExpense(entry.id, String(data.get("reason")));
            else {
              attempt.current ??= {
                vendorId: String(data.get("stall")) || null,
                amountSen: Math.round(Number(data.get("amount")) * 100),
                label: String(data.get("label")),
                idempotencyKey: crypto.randomUUID(),
              };
              await api.expense(attempt.current);
            }
            saved();
          } catch (problem) {
            if (!entry && attempt.current) {
              if (problem instanceof ApiError && [400, 403, 409].includes(problem.status)) {
                attempt.current = undefined;
                setPending(false);
              } else setPending(true);
            }
            setError(messageOf(problem));
          } finally {
            setBusy(false);
          }
        }}
      >
        {entry ? (
          <>
            <p>
              {entry.label} · {money(entry.amount_sen)}
            </p>
            <label className="field">
              Reason
              <textarea name="reason" maxLength={250} required />
            </label>
          </>
        ) : (
          <fieldset className="stack" disabled={pending || busy}>
            <label className="field">
              Amount (RM)
              <input name="amount" type="number" min=".01" max="100000" step=".01" required />
            </label>
            <label className="field">
              Description
              <input name="label" required maxLength={150} />
            </label>
            <label className="field">
              Stall
              <select name="stall" defaultValue={defaultStall ?? ""}>
                <option value="">Shared cafeteria overhead</option>
                {stalls.map((stall) => (
                  <option key={stall.id} value={stall.id}>
                    {stall.name}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
        )}
        <ErrorMessage message={error} />
        <button className="button primary" disabled={busy}>
          {entry ? "Confirm reversal" : pending ? "Retry same expense" : "Save demo expense"}
        </button>
      </form>
    </Modal>
  );
}
