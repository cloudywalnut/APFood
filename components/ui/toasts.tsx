"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
export function ToastOutlet() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function show(event: Event) {
      setMessage(String((event as CustomEvent).detail));
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(""), 5000);
    }
    window.addEventListener("apfoods-notice", show);
    return () => {
      window.removeEventListener("apfoods-notice", show);
      clearTimeout(timer);
    };
  }, []);
  return (
    <div className="ap-toast-region" role="status" aria-live="polite">
      {message && (
        <div className="ap-action-toast">
          <CheckCircle2 size={21} />
          <span>{message}</span>
          <button aria-label="Dismiss notification" onClick={() => setMessage("")}>
            <X size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
