"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Clock3, Grid2X2, Map, MapPin, Search, SlidersHorizontal, Tag, X } from "lucide-react";
import { money } from "../../lib/orders";
import { sampleLayout } from "../../lib/cafeteria/layout";
import { select, type Selection, type SelectionAction } from "../../lib/cafeteria/selection";
import { CafeteriaMap } from "../cafeteria/map";
import { cuisines, cuisineMatches, mealPhoto, type Catalogue, type Stall } from "./catalogue";

export type Pickup = { vendor_id: string; starts_at: string; reserved_units: number; total_units: number };

export function Marketplace({
  data,
  buckets = [],
  recommendation,
  activeOrder,
  areaId,
  initialView = "list",
}: {
  data: Catalogue;
  buckets?: Pickup[];
  recommendation?: ReactNode;
  activeOrder?: ReactNode;
  areaId?: string;
  initialView?: "list" | "map";
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("dish") ?? "");
  const [zone, setZone] = useState("");
  const [cuisine, setCuisine] = useState("all");
  const [openOnly, setOpenOnly] = useState(false);
  const [offersOnly, setOffersOnly] = useState(false);
  const [sort, setSort] = useState("recommended");
  const [view, setView] = useState(initialView);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selection, setSelection] = useState<Selection>({ areaId });
  useEffect(() => setQuery(params.get("dish") ?? ""), [params]);
  useEffect(() => {
    const stall = params.get("stall");
    setSelection(
      stall && sampleLayout.locations.some((location) => location.stallId === stall)
        ? select({}, { type: "stall", id: stall }, sampleLayout)
        : { areaId },
    );
    setView(areaId ? "map" : initialView);
  }, [areaId, initialView, params]);
  const menus = useMemo(
    () =>
      new globalThis.Map(
        data.vendors.map((stall) => [stall.id, data.items.filter((item) => item.vendor_id === stall.id)]),
      ),
    [data],
  );
  const upcoming = new globalThis.Map(
    data.vendors.map((stall) => [
      stall.id,
      !stall.paused
        ? buckets
            .filter(
              (bucket) =>
                bucket.vendor_id === stall.id &&
                Date.parse(bucket.starts_at) >= Date.now() + stall.lead_minutes * 60_000 &&
                bucket.reserved_units < bucket.total_units,
            )
            .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0]
        : undefined,
    ]),
  );
  const price = (id: string) =>
    Math.min(
      ...(menus.get(id) ?? []).filter((item) => item.stock > 0).map((item) => item.price_sen - item.discount_sen),
      Infinity,
    );
  const deals = data.items
    .filter(
      (item) =>
        item.discount_sen > 0 && item.stock > 0 && !data.vendors.find((stall) => stall.id === item.vendor_id)?.paused,
    )
    .sort((a, b) => b.discount_sen - a.discount_sen);
  const maximumSaving = Math.max(0, ...deals.map((item) => item.discount_sen));
  const selectedArea = sampleLayout.areas.find((area) => area.id === areaId);
  const matching = data.vendors
    .filter((stall) => {
      const items = menus.get(stall.id) ?? [];
      return (
        (!areaId ||
          sampleLayout.locations.some((location) => location.areaId === areaId && location.stallId === stall.id)) &&
        (!zone || stall.zone_id === zone) &&
        (!openOnly || (!stall.paused && Boolean(upcoming.get(stall.id)))) &&
        (!offersOnly || items.some((item) => item.stock > 0 && item.discount_sen > 0)) &&
        cuisineMatches(stall, items, cuisine) &&
        (stall.name + " " + stall.category + " " + items.map((item) => item.name + " " + item.description).join(" "))
          .toLowerCase()
          .includes(query.trim().toLowerCase())
      );
    })
    .sort((a, b) =>
      sort === "price"
        ? price(a.id) - price(b.id)
        : sort === "name"
          ? a.name.localeCompare(b.name)
          : Number(a.paused) - Number(b.paused) ||
            (Date.parse(upcoming.get(a.id)?.starts_at ?? "") || Infinity) -
              (Date.parse(upcoming.get(b.id)?.starts_at ?? "") || Infinity) ||
            a.lead_minutes - b.lead_minutes,
    );
  const filtered = Boolean(query || zone || cuisine !== "all" || openOnly || offersOnly);
  function reset() {
    setQuery("");
    setZone("");
    setCuisine("all");
    setOpenOnly(false);
    setOffersOnly(false);
    setSort("recommended");
  }
  function dispatch(action: SelectionAction) {
    if (action.type === "stall") router.push("/app/vendors/" + action.id);
    else if (action.type === "area") router.push("/app/vendors/area/" + action.id);
    else setSelection((previous) => select(previous, action, sampleLayout));
  }
  return (
    <div className="marketplace">
      <aside className={"market-filters " + (filtersOpen ? "is-open" : "")}>
        <button
          type="button"
          className="market-filters-toggle"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <SlidersHorizontal size={18} aria-hidden />
          Filters{filtered && <span>Active</span>}
        </button>
        <div className="market-filter-body">
          <div className="market-filter-heading">
            <h2>Filters</h2>
            {filtered && <button onClick={reset}>Reset</button>}
          </div>
          <fieldset>
            <legend>Sort by</legend>
            {[
              ["recommended", "Recommended"],
              ["quickest", "Soonest pickup"],
              ["price", "Lowest starting price"],
              ["name", "Stall name"],
            ].map(([value, label]) => (
              <label className="market-radio" key={value}>
                <input
                  type="radio"
                  name="stall-sort"
                  value={value}
                  checked={sort === value}
                  onChange={() => setSort(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Make it a good break</legend>
            <label className="market-radio">
              <input type="checkbox" checked={openOnly} onChange={(event) => setOpenOnly(event.target.checked)} />
              Pickup available
            </label>
            <label className="market-radio">
              <input type="checkbox" checked={offersOnly} onChange={(event) => setOffersOnly(event.target.checked)} />
              Deals available
            </label>
          </fieldset>
          <label className="market-filter-select">
            Food court
            <select value={zone} onChange={(event) => setZone(event.target.value)}>
              <option value="">All food courts</option>
              {data.zones.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
          <div className="market-pickup-note">
            <Clock3 size={19} aria-hidden />
            <strong>Made for your lunch break.</strong>
            <p>Choose a pickup window at checkout. Your meal will have a time and a place.</p>
            <Link href="/app/traffic">
              See current traffic
              <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </div>
      </aside>
      <div className={"market-content" + (view === "map" ? " view-map" : "")}>
        <section className="market-hero">
          <div>
            <span>GOOD FOOD. RIGHT ON CAMPUS.</span>
            <h1>
              Your lunch break,
              <br />
              well spent.
            </h1>
            <p>
              Find your favourite counter. Order ahead.
              <br />
              Pick up when it fits your day.
            </p>
            <a href="#campus-stalls" className="button primary">
              Explore the stalls
              <ArrowRight size={17} aria-hidden />
            </a>
          </div>
          <div className="market-hero-photo">
            <Image
              src="/food/lunch.webp"
              alt="A Malaysian chicken and rice meal"
              fill
              sizes="(max-width: 700px) 40vw, 380px"
              preload
            />
          </div>
          {maximumSaving > 0 && (
            <Link className="market-hero-offer" href={"/app/vendors/" + deals[0].vendor_id + "/item/" + deals[0].id}>
              <Tag size={15} aria-hidden />
              <span>
                Meal deals · Save up to <strong>{money(maximumSaving)}</strong>
              </span>
            </Link>
          )}
        </section>
        {activeOrder}
        {recommendation && <div className="market-intelligence">{recommendation}</div>}
        <section className="market-cuisines">
          <div className="market-section-heading">
            <h2>What are you craving?</h2>
            <span>A little of everything.</span>
          </div>
          <div className="market-cuisine-row">
            {cuisines.map((entry) => (
              <button key={entry.id} aria-pressed={cuisine === entry.id} onClick={() => setCuisine(entry.id)}>
                <span>
                  <Image src={entry.image} alt="" width={80} height={80} />
                </span>
                {entry.label}
              </button>
            ))}
          </div>
        </section>
        {deals.length > 0 && !filtered && !areaId && (
          <section className="market-offers">
            <div className="market-section-heading">
              <h2>A little more for your money</h2>
              <button onClick={() => setOffersOnly(true)}>
                All deals
                <ArrowRight size={15} aria-hidden />
              </button>
            </div>
            <div className="market-offer-grid">
              {deals.slice(0, 3).map((item) => (
                <Link
                  key={item.id}
                  href={"/app/vendors/" + item.vendor_id + "/item/" + item.id}
                  className="market-offer-card"
                >
                  <div>
                    <span>Save {money(item.discount_sen)}</span>
                    <h3>{item.name}</h3>
                    <p>{data.vendors.find((stall) => stall.id === item.vendor_id)?.name}</p>
                    <strong>
                      {money(item.price_sen - item.discount_sen)} <del>{money(item.price_sen)}</del>
                    </strong>
                  </div>
                  {mealPhoto(item) && <Image src={mealPhoto(item)!} alt="" width={125} height={125} />}
                </Link>
              ))}
            </div>
          </section>
        )}
        <section className="market-results" id="campus-stalls">
          <div className="market-section-heading">
            <div>
              <h2>{selectedArea ? selectedArea.name : "Your campus favourites"}</h2>
              <p aria-live="polite">
                {matching.length} {matching.length === 1 ? "stall" : "stalls"}
                {filtered ? " matching your selection" : " to make your next break better"}
              </p>
            </div>
            <div className="market-view-switch" aria-label="Browse view">
              <button aria-pressed={view === "list"} aria-label="Card view" onClick={() => setView("list")}>
                <Grid2X2 size={17} aria-hidden />
                <span>Stalls</span>
              </button>
              <button aria-pressed={view === "map"} aria-label="Map view" onClick={() => setView("map")}>
                <Map size={17} aria-hidden />
                <span>Map</span>
              </button>
            </div>
          </div>
          <label className="market-local-search">
            <Search size={19} aria-hidden />
            <input
              type="search"
              placeholder="Find a stall or your favourite dish"
              aria-label="Find a stall or meal"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button aria-label="Clear search" onClick={() => setQuery("")}>
                <X size={16} aria-hidden />
              </button>
            )}
          </label>
          {areaId && (
            <Link className="market-clear-area" href="/app/vendors">
              All cafeteria areas
              <ArrowRight size={15} aria-hidden />
            </Link>
          )}
          {view === "map" ? (
            <CafeteriaMap
              layout={sampleLayout}
              vendors={matching.map((stall) => ({
                ...stall,
                zone: data.zones.find((entry) => entry.id === stall.zone_id)?.name ?? stall.zone_id,
                lead: stall.lead_minutes,
                hours: stall.opens_at.slice(0, 5) + "–" + stall.closes_at.slice(0, 5) + " MYT",
              }))}
              selection={selection}
              dispatch={dispatch}
              areaId={areaId}
              matchingStalls={matching.map((stall) => stall.id)}
            />
          ) : (
            <div className="market-stall-grid">
              {matching.map((stall) => (
                <StallCard
                  key={stall.id}
                  stall={stall}
                  zone={data.zones.find((entry) => entry.id === stall.zone_id)?.name ?? stall.zone_id}
                  startingPrice={price(stall.id)}
                  pickup={upcoming.get(stall.id)?.starts_at}
                  hasOffer={(menus.get(stall.id) ?? []).some((item) => item.stock > 0 && item.discount_sen > 0)}
                />
              ))}
            </div>
          )}
          {!matching.length && (
            <div className="market-empty">
              <Search size={28} aria-hidden />
              <h3>No matches this time.</h3>
              <p>Try another dish or clear a filter to see more stalls.</p>
              <button className="button secondary" onClick={reset}>
                Clear filters
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StallCard({
  stall,
  zone,
  startingPrice,
  pickup,
  hasOffer,
}: {
  stall: Stall;
  zone: string;
  startingPrice: number;
  pickup?: string;
  hasOffer: boolean;
}) {
  const photo =
    sampleLayout.locations.find((location) => location.stallId === stall.id)?.photo ?? "/food/" + stall.image + ".webp";
  return (
    <Link href={"/app/vendors/" + stall.id} className="market-stall-card">
      <div className="market-stall-image">
        <Image
          src={photo}
          alt={stall.name + " counter"}
          fill
          sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 30vw"
        />
        {hasOffer && (
          <span className="market-stall-deal">
            <Tag size={13} aria-hidden />
            Meal deals
          </span>
        )}
        <span className="market-stall-time">
          <Clock3 size={13} aria-hidden />
          {stall.paused
            ? "Intake paused"
            : pickup
              ? "From " +
                new Date(pickup).toLocaleTimeString("en-MY", {
                  timeZone: "Asia/Kuala_Lumpur",
                  hour: "numeric",
                  minute: "2-digit",
                })
              : stall.lead_minutes + " min prep"}
        </span>
      </div>
      <div className="market-stall-description">
        <h3>{stall.name}</h3>
        <p>{stall.category}</p>
        <div>
          <span>
            <MapPin size={13} aria-hidden />
            {zone}
          </span>
          {Number.isFinite(startingPrice) && <strong>From {money(startingPrice)}</strong>}
        </div>
      </div>
    </Link>
  );
}
