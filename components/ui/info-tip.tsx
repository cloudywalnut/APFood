"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Explicit, local help for concepts that need explanation. No page-wide hover listeners. */
export function InfoTip({ label, text }: { label: string; text: string }) {
  const id = useId(),
    button = useRef<HTMLButtonElement>(null),
    popup = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hold = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const leave = () => {
    hold();
    closeTimer.current = setTimeout(() => {
      if (document.activeElement !== button.current) setOpen(false);
    }, 150);
  };
  useEffect(() => () => hold(), []);
  const [open, setOpen] = useState(false),
    [position, setPosition] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    if (!open || !button.current || !popup.current) return;
    const r = button.current.getBoundingClientRect(),
      p = popup.current.getBoundingClientRect();
    setPosition({
      left: Math.max(12, Math.min(innerWidth - p.width - 12, r.right - p.width + 6)),
      top: r.top - p.height - 10 >= 12 ? r.top - p.height - 10 : Math.min(innerHeight - p.height - 12, r.bottom + 10),
    });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const outside = (e: PointerEvent) => {
      if (!button.current?.contains(e.target as Node) && !popup.current?.contains(e.target as Node)) close();
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);
  return (
    <span
      className="info-tip-anchor"
      onMouseEnter={() => {
        hold();
        setOpen(true);
      }}
      onMouseLeave={leave}
    >
      <button
        ref={button}
        type="button"
        className="ap-info-tip"
        aria-label={"About " + label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        i
      </button>
      {open &&
        createPortal(
          <span
            ref={popup}
            id={id}
            role="tooltip"
            onMouseEnter={hold}
            onMouseLeave={leave}
            className="ap-info-popup"
            style={position}
          >
            {text}
          </span>,
          button.current?.closest("dialog") ?? document.body,
        )}
    </span>
  );
}
