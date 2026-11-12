"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { money } from "../../lib/demo";
import { ErrorMessage } from "../shared";
import { messageOf, RemoteStatus, useHostedData, useRemote } from "./common";

export function OrderPayment({ id, total, version, customer = false, changed }: {
  id: string; total: number; version: number; customer?: boolean; changed: () => void;
}) {
  const api = useHostedData();
  const load = useCallback(() => api.orderPayment(id), [api, id, version]);
  const result = useRemote(load);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (result.value === undefined) return <RemoteStatus error={result.error} reload={result.reload} />;
  const payment = result.value;
  if (!payment) return null;
  const pending = payment.status === "pending";
  const remaining = payment.expires_at ? Math.max(0, Math.ceil((Date.parse(payment.expires_at) - now) / 1000)) : 0;
  const labels = { pending: remaining ? "Awaiting payment" : "Payment window expired", paid: "Paid", expired: "Payment window expired", refund_pending: "Refund pending", refunded: "Refund recorded" };
  return <section className="panel stack payment-panel"><div className="line spread wrap"><h2>DuitNow QR</h2>
    <span className={"badge " + (payment.status === "paid" ? "good" : "neutral")}>{labels[payment.status]}</span></div>
    {customer && pending && remaining > 0 && <>
      <p>Pay <strong>{money(total)}</strong> to <strong>{payment.merchant_name}</strong>, then confirm below.</p>
      {payment.qrUrl && <Image className="merchant-qr" src={payment.qrUrl} alt={"DuitNow QR for " + payment.merchant_name} width={260} height={260} unoptimized />}
      <p className="small muted">Order reference · {id.slice(0, 8).toUpperCase()}<br />Complete within {Math.floor(remaining / 60)}m {remaining % 60}s</p>
      <button className="button primary" disabled={busy} onClick={async () => {
        setBusy(true); setError("");
        try { await api.claimPayment(id); result.reload(); changed(); }
        catch (problem) { setError(messageOf(problem)); result.reload(); changed(); }
        finally { setBusy(false); }
      }}>{busy ? "Confirming…" : "I've paid"}</button>
    </>}
    {customer && pending && remaining === 0 && <p>The payment window has ended. Your reservation will be released automatically.</p>}
    {payment.status === "paid" && <p>Payment received · {money(total)}.{customer ? " Follow the order status for your pickup." : " Recorded from the student’s payment confirmation."}</p>}
    {payment.status === "refund_pending" && (customer ? <p>The stall will arrange your refund. Contact them with your order reference.</p>
      : <form className="stack" onSubmit={async event => {
        event.preventDefault(); const data = new FormData(event.currentTarget);
        setBusy(true); setError("");
        try { await api.refund(id, String(data.get("reference"))); result.reload(); changed(); }
        catch (problem) { setError(messageOf(problem)); } finally { setBusy(false); }
      }}><p>Complete the refund through your bank before recording it here.</p><label className="field">Bank refund reference<input name="reference" required maxLength={120} /></label><button className="button primary" disabled={busy}>Record completed refund</button></form>)}
    {payment.status === "refunded" && <p>Refund reference · {payment.refund_reference}</p>}
    <ErrorMessage message={error} />
  </section>;
}

export function VendorPaymentSettings({ vendorId }: { vendorId: string }) {
  const api = useHostedData();
  const load = useCallback(() => api.vendorPayment(vendorId), [api, vendorId]);
  const result = useRemote(load);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  if (result.value === undefined) return <RemoteStatus error={result.error} reload={result.reload} />;
  return <section className="panel stack"><div><h2>Accept DuitNow QR payments</h2><p className="muted">Add your merchant QR and the name customers see in their banking app.</p></div>
    {result.value?.qrUrl && <Image className="merchant-qr" src={result.value.qrUrl} alt="Your saved merchant QR" width={220} height={220} unoptimized />}
    <form className="stack" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError(""); setNotice("");
      const data = new FormData(event.currentTarget);
      try { await api.uploadQr(vendorId, data); result.reload(); setNotice("Your payment settings were saved."); }
      catch (problem) { setError(messageOf(problem)); } finally { setBusy(false); }
    }}><label className="field">Merchant name<input name="merchantName" required maxLength={100} defaultValue={result.value?.merchant_name ?? ""} /></label>
      <label className="field">DuitNow QR image<input name="qr" type="file" accept="image/png,image/jpeg,image/webp" required /></label>
      <p className="small muted">PNG, JPEG, or WebP · Maximum 2 MB</p><ErrorMessage message={error} />
      {notice && <p className="success" role="status">{notice}</p>}
      <button className="button primary" disabled={busy}>{busy ? "Uploading…" : "Save payment settings"}</button></form>
  </section>;
}
