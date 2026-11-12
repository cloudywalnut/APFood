"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Copy } from "lucide-react";
import { Modal } from "../shared";
import { TabBar } from "../ui/primitives";

export function PickupDialog({
  code,
  expiresAt,
  close,
  regenerate,
}: {
  code: string;
  expiresAt?: number;
  close: () => void;
  regenerate: () => void | Promise<void>;
}) {
  const [tab, setTab] = useState("qr");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const [image, setImage] = useState<{ code: string; src: string }>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let current = true;
    import("qrcode")
      .then((module) => module.toDataURL(code, { margin: 2, width: 216 }))
      .then((src) => {
        if (current) setImage({ code, src });
      })
      .catch(() => {
        if (current) setMessage("The QR could not load. Use the text code.");
      });
    return () => {
      current = false;
    };
  }, [code]);
  return (
    <Modal title="Pickup code" close={close}>
      <p>Show this code to the stall when you collect your order. The code is valid for five minutes.</p>
      <TabBar
        label="Pickup code format"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "qr", label: "QR code" },
          { id: "manual", label: "Manual code" },
        ]}
      />
      {tab === "qr" && image?.code === code && (
        <Image className="pickup-qr" src={image.src} width={216} height={216} unoptimized alt="Scannable pickup QR" />
      )}
      {expiresAt && (
        <p className={expiresAt > now ? "small muted" : "error"}>
          {expiresAt > now
            ? "Code expires in " + Math.ceil((expiresAt - now) / 1000) + " seconds"
            : "This code expired. Generate a new code."}
        </p>
      )}
      <div className={"pickup-code" + (/^\d{8}$/.test(code) ? " pickup-code-short" : "")}>{code}</div>
      <p className="small muted">
        {expiresAt
          ? "Expires " +
            new Date(expiresAt).toLocaleTimeString("en-MY", {
              timeZone: "Asia/Kuala_Lumpur",
              hour: "numeric",
              minute: "2-digit",
            })
          : ""}
      </p>
      <div className="line wrap">
        <button
          className="button secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setMessage("Code copied.");
            } catch {
              setMessage("Select and copy the text code above.");
            }
          }}
        >
          <Copy size={16} aria-hidden /> Copy code
        </button>
        <button
          className="button secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await regenerate();
              setMessage("New code generated.");
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "Could not generate a new code.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Generate new code
        </button>
      </div>
      <p className="small" role="status">
        {message}
      </p>
    </Modal>
  );
}
