"use client";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { glassCounter, seatingPositions, entrancePosition } from "../../lib/cafeteria/layout";
import type { TrafficLoad } from "../../lib/traffic-load";
import type { Vendor } from "../../lib/cafeteria/types";
import type { CafeteriaLayout, StallLocation } from "../../lib/cafeteria/types";
import type { Selection, SelectionAction } from "../../lib/cafeteria/selection";
function PreviewSurface({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}
export function StallHoverPreview({
  location,
  vendor,
  load,
  anchor,
}: {
  location: StallLocation;
  vendor?: Vendor;
  load?: TrafficLoad;
  anchor: { left: number; top: number };
}) {
  return (
    <aside
      style={{ "--preview-left": anchor.left + "px", "--preview-top": anchor.top + "px" } as CSSProperties}
      className="caf-preview caf-stall-card"
      aria-label={(vendor?.name ?? location.label) + " preview"}
    >
      <img src={location.photo} alt={location.photoAlt} width="450" height="253" />
      <div className="caf-stall-card-copy">
        <span className="caf-stall-card-eyebrow">{vendor?.category || location.label}</span>
        <strong>{vendor?.name ?? location.label}</strong>
        {vendor?.description && <p>{vendor.description}</p>}
        {load ? (
          <small className={"caf-stall-card-load load-" + load.level}>
            <i className={"traffic-dot load-" + load.level} />
            {load.label}
            {load.peakPercent !== undefined ? " · " + load.peakPercent + "% peak" : ""}
          </small>
        ) : (
          vendor && <small>{vendor.paused ? "Intake paused" : vendor.hours}</small>
        )}
      </div>
    </aside>
  );
}

function Tree({ x, y, small = false }: { x: number; y: number; small?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${small ? 0.7 : 1})`} aria-hidden="true">
      <rect x="-20" y="10" width="40" height="15" rx="2" fill="#d9cbb4" stroke="#a99579" />
      <path d="M0 15V-12" stroke="#967953" strokeWidth="5" />
      <path
        d="M-9 8C-29 9-27-12-15-13C-19-33 4-35 7-20C27-26 31-4 17 2C19 16 4 20-2 9Z"
        fill="#9bb769"
        stroke="#77944d"
        strokeWidth="1.5"
      />
      <path d="M1-23L0 12M-12-7L0 2M13-9L0 5" fill="none" stroke="#7f9a56" strokeWidth="1.5" />
    </g>
  );
}
function Table({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden="true">
      <ellipse cx="0" cy="8" rx="29" ry="24" fill="#b8a087" opacity=".15" />
      <path d="M-30-10v20M30-10v20M-10-28h20M-10 28h20" stroke="#a68b6e" strokeWidth="9" strokeLinecap="round" />
      <rect x="-23" y="-21" width="46" height="42" rx="5" fill="url(#table-top)" stroke="#a68b6e" strokeWidth="2" />
      <path d="M-17 16v10M17 16v10" stroke="#a68b6e" strokeWidth="3" />
    </g>
  );
}
function Counter({
  x,
  y,
  width = 100,
  height = 76,
  muted = false,
  tint,
}: {
  x: number;
  y: number;
  width?: number;
  height?: number;
  muted?: boolean;
  tint?: string;
}) {
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden="true" filter="url(#counter-shadow)">
      <rect
        x="5"
        y="13"
        width={width - 10}
        height={height - 13}
        fill="url(#counter-wood)"
        stroke="#967452"
        strokeWidth="2"
      />
      <rect x="12" y="27" width={width - 24} height={height - 44} fill="#f6eddd" stroke="#b8a082" />
      <path d={`M${width / 2} 28V${height - 20}`} stroke="#b8a082" strokeWidth="2" />
      <rect x="7" y={height - 21} width={width - 14} height="9" fill="#b58b55" stroke="#95744c" />
      <path
        d={`M5 20L12 0H${width - 12}L${width - 5} 20Z`}
        fill={tint ?? (muted ? "#d3cbb8" : "#f6ce5c")}
        stroke="#a88c5a"
        strokeWidth="2"
      />
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M${19 + (i * (width - 30)) / 3} 1l-3 18h${(width - 30) / 6}l1-18Z`} fill="#fff9e8" />
      ))}
      <path
        d={`M5 20q${(width - 10) / 8} 8 ${(width - 10) / 4} 0q${(width - 10) / 8} 8 ${(width - 10) / 4} 0q${(width - 10) / 8} 8 ${(width - 10) / 4} 0q${(width - 10) / 8} 8 ${(width - 10) / 4} 0`}
        fill="none"
        stroke="#ad8d4c"
        strokeWidth="1"
      />
      <path d={`M19 ${height - 10}v10M${width - 19} ${height - 10}v10`} stroke="#a68b6e" strokeWidth="4" />
      <rect x="17" y={height - 15} width="18" height="6" rx="2" fill="#d3b17c" stroke="#987d58" />
      <rect x={width - 35} y={height - 15} width="18" height="6" rx="2" fill="#d3b17c" stroke="#987d58" />
    </g>
  );
}
function MapLabel({
  x,
  y,
  width,
  text,
  lines,
}: {
  x: number;
  y: number;
  width: number;
  text: string;
  lines?: string[];
}) {
  const height = lines ? 32 : 28;
  return (
    <g className="caf-map-label" pointerEvents="none">
      <rect
        x={x - width / 2}
        y={y}
        width={width}
        height={height}
        rx="14"
        fill="#fff7e9"
        stroke="#b88c51"
        strokeWidth="1.5"
      />
      <text
        x={x}
        y={y + (lines ? 13 : 18)}
        textAnchor="middle"
        fontFamily="Roboto, Arial, sans-serif"
        fontSize="13"
        fontWeight="600"
        fill="#56371f"
      >
        {lines
          ? lines.map((line, i) => (
              <tspan key={line} x={x} dy={i ? 14 : 0}>
                {line}
              </tspan>
            ))
          : text}
      </text>
    </g>
  );
}
export function CafeteriaMap({
  layout,
  vendors,
  selection,
  dispatch,
  areaId,
  matchingStalls,
  traffic,
}: {
  layout: CafeteriaLayout;
  vendors: Vendor[];
  selection: Selection;
  dispatch: (action: SelectionAction) => void;
  mode?: "areas" | "stalls";
  areaId?: string;
  matchingStalls?: string[];
  traffic?: Record<string, TrafficLoad>;
}) {
  const [anchor, setAnchor] = useState({ left: 16, top: 100 }),
    [dismissed, setDismissed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const focused = useRef(false);
  const previewId = dismissed ? undefined : selection.hoveredStall;
  const location = layout.locations.find((l) => l.stallId === previewId);
  const previewVendor = location ? vendors.find((v) => v.id === location.stallId) : undefined;
  function cancel() {
    if (timer.current) clearTimeout(timer.current);
  }
  function leave() {
    cancel();
    if (window.matchMedia("(hover:none)").matches) return;
    timer.current = setTimeout(() => {
      if (!focused.current) dispatch({ type: "hover-stall" });
    }, 220);
  }
  useEffect(() => () => cancel(), []);
  function preview(id: string, target: Element) {
    cancel();
    const r = target.getBoundingClientRect(),
      w = Math.min(440, window.innerWidth - 24),
      h = 200;
    const fitsRight = r.right + w + 20 < window.innerWidth,
      fitsLeft = r.left - w - 20 > 0;
    setAnchor({
      left: Math.max(
        12,
        Math.min(
          window.innerWidth - w - 12,
          fitsRight ? r.right + 10 : fitsLeft ? r.left - w - 10 : r.left + r.width / 2 - w / 2,
        ),
      ),
      top: Math.max(84, Math.min(window.innerHeight - h - 12, r.top - 12)),
    });
    setDismissed(false);
    dispatch({ type: "hover-stall", id });
  }
  function choose(id: string) {
    if (!vendors.some((v) => v.id === id)) return;
    cancel();
    setDismissed(true);
    dispatch({ type: "stall", id });
  }
  const floor = "M380 632H24V24H876V632H520";
  return (
    <section className="panel caf-map-card reference-map">
      <div className="caf-map-heading">
        <div>
          <small>{traffic ? "APP PICKUP LOAD · NEXT 30 MINUTES" : "EXPLORE · CHOOSE · ENJOY"}</small>
          <h2>Campus Cafeteria</h2>
        </div>
        <span className="badge neutral">Interactive map</span>
      </div>
      <p className="caf-hint">
        {traffic
          ? "Select a counter to view its pickup load. Colours show booked capacity, not measured queues."
          : "Hover to meet a stall. Select it to see the menu."}
      </p>
      <div
        className="caf-map-stage"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            focused.current = false;
            cancel();
            setDismissed(true);
            dispatch({ type: "hover-stall" });
          }
        }}
        onMouseLeave={leave}
      >
        <svg
          className="caf-floorplan reference-floorplan"
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          aria-label="Interactive cafeteria floor plan"
        >
          <defs>
            <linearGradient id="floor-wash" x2="0" y2="1">
              <stop stopColor="#fcf4e5" />
              <stop offset="1" stopColor="#eddbc2" />
            </linearGradient>
            <linearGradient id="counter-wood" x2="0" y2="1">
              <stop stopColor="#e0c298" />
              <stop offset="1" stopColor="#b18b5c" />
            </linearGradient>
            <linearGradient id="table-top" x2="0" y2="1">
              <stop stopColor="#ead5b2" />
              <stop offset="1" stopColor="#cdb08b" />
            </linearGradient>
            <pattern id="floor-tiles" width="22" height="22" patternUnits="userSpaceOnUse">
              <path d="M22 0H0V22" fill="none" stroke="#dac4a5" strokeOpacity=".3" strokeWidth=".7" />
            </pattern>
            <filter id="counter-shadow" x="-20%" y="-20%" width="140%" height="160%">
              <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#8a6844" floodOpacity=".18" />
            </filter>
            <filter id="area-glow" x="-20%" y="-30%" width="140%" height="160%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>
          <rect width={layout.width} height={layout.height} rx="24" fill="#f6ecdc" />
          <g aria-hidden="true" className="caf-map-boundary">
            <path d={floor} fill="url(#floor-wash)" stroke="#a89d90" strokeWidth="14" strokeLinejoin="miter" />
            <path d={floor} fill="url(#floor-tiles)" stroke="#d5c9bb" strokeWidth="7" />
            <path d="M380 620v24M520 620v24" stroke="#ab9c89" strokeWidth="3" />
          </g>
          {[
            { x: 120, y: 70 },
            { x: 775, y: 70 },
            { x: 80, y: 600 },
            { x: 820, y: 600 },
            { x: 285, y: 570 },
            { x: 450, y: 570 },
            { x: 615, y: 570 },
          ].map((t, i) => (
            <Tree key={i} {...t} small={i > 1} />
          ))}
          {seatingPositions.map((t, i) => (
            <Table key={i} {...t} />
          ))}
          <g aria-hidden="true">
            <rect x="355" y="540" width="190" height="25" rx="10" fill="#d8c8ae" stroke="#ae9a7e" />
            {[375, 405, 435, 465, 495, 525].map((x) => (
              <path key={x} d={`M${x} 550v-16`} stroke="#93ad60" strokeWidth="16" strokeLinecap="round" />
            ))}
          </g>

          {layout.locations.map((l) => {
            const vendor = vendors.find((v) => v.id === l.stallId);
            const active = previewId === l.stallId || Boolean(traffic && selection.stallId === l.stallId);
            const load = traffic?.[l.stallId];
            const tint = load
              ? { low: "#bed6a6", moderate: "#edc362", busy: "#df8c82", unknown: "#d0cbc2" }[load.level]
              : undefined;
            return (
              <g
                key={l.id}
                role="button"
                tabIndex={0}
                aria-label={
                  (traffic ? "Pickup load for " : "Preview stall ") +
                  l.label +
                  (load
                    ? " · " +
                      load.label +
                      (load.peakPercent !== undefined ? " · " + load.peakPercent + "% peak capacity" : "")
                    : "") +
                  (l.stallId === "local-corner-left" ? " left" : l.stallId === "local-corner-right" ? " right" : "")
                }
                aria-pressed={active}
                className={"caf-map-stall reference-counter " + (active ? "is-selected" : "")}
                style={{ opacity: matchingStalls && !matchingStalls.includes(l.stallId) ? 0.25 : 1 }}
                onMouseEnter={(e) => {
                  if (window.matchMedia("(hover:hover)").matches) preview(l.stallId, e.currentTarget);
                }}
                onMouseLeave={leave}
                onFocus={(e) => {
                  focused.current = true;
                  preview(l.stallId, e.currentTarget);
                }}
                onBlur={() => {
                  focused.current = false;
                  leave();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (traffic) choose(l.stallId);
                  else if (window.matchMedia("(hover:none), (max-width:760px)").matches && previewId !== l.stallId)
                    preview(l.stallId, e.currentTarget);
                  else choose(l.stallId);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    choose(l.stallId);
                  }
                }}
              >
                <rect
                  x={l.x - 7}
                  y={l.y - 6}
                  width={l.width + 14}
                  height={l.height + (l.stallId === "green-bowl-kitchen" ? 44 : 32)}
                  rx="12"
                  fill={tint ?? (active ? "#fff3d6" : "transparent")}
                  stroke={active ? "#56371f" : (tint ?? "transparent")}
                  strokeWidth="3"
                />
                <Counter {...l} muted={vendor?.paused} tint={tint} />
                <MapLabel
                  x={l.x + l.width / 2}
                  y={l.areaId === "north" ? l.y - 42 : l.y + l.height + 6}
                  width={l.stallId === "green-bowl-kitchen" ? 150 : l.areaId === "north" ? 136 : 124}
                  text={l.label}
                  lines={l.stallId === "green-bowl-kitchen" ? ["Japan &", "Korea"] : undefined}
                />
              </g>
            );
          })}
          <g aria-label="Glass Window" pointerEvents="none">
            <rect
              x={glassCounter.x}
              y={glassCounter.y}
              width={glassCounter.width}
              height={glassCounter.height}
              rx="3"
              fill="#c0d6ce"
              fillOpacity=".8"
              stroke="#8eaa9f"
              strokeWidth="2"
            />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <g key={i}>
                <path
                  d={`M${glassCounter.x + (i * glassCounter.width) / 6} ${glassCounter.y}v${glassCounter.height}`}
                  stroke="#8a9b8c"
                  strokeWidth="2"
                />
                <path
                  d={`M${glassCounter.x + 10 + (i * glassCounter.width) / 6} ${glassCounter.y + 34}l30-27m-13 30l30-30`}
                  stroke="#fffaf0"
                  strokeOpacity=".65"
                  strokeWidth="4"
                />
              </g>
            ))}
            <path
              d={`M${glassCounter.x} ${glassCounter.y + glassCounter.height + 4}h${glassCounter.width}`}
              stroke="#b58b55"
              strokeWidth="6"
            />
          </g>
          <MapLabel x={450} y={224} width={215} text="Glass Window" />

          <g
            aria-label="Enter here"
            pointerEvents="none"
            transform={`translate(${entrancePosition.x} ${entrancePosition.y})`}
          >
            <path
              d="M0-7v-24m-9 9l9-9 9 9"
              fill="none"
              stroke="#a97819"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <MapLabel x={0} y={-1} width={108} text="Enter here" />
          </g>
        </svg>
        {location && (
          <PreviewSurface>
            <StallHoverPreview
              key={location.id}
              location={location}
              vendor={previewVendor}
              load={traffic?.[location.stallId]}
              anchor={anchor}
            />
          </PreviewSurface>
        )}
      </div>
      {!traffic && (
        <div className="caf-map-legend">
          <span>
            <i />
            Select a counter to order
          </span>
          <span>
            <i />
            Shared seating
          </span>
        </div>
      )}
    </section>
  );
}
