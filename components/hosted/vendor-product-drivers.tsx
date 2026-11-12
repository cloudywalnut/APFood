"use client";

import { memo, useMemo, useState } from "react";
import Link from "next/link";
import type { hostedData } from "../../lib/backend/client";
import { productDrivers, type ProductMeasure } from "../../lib/vendor-chart-data";
import { cleanMenuName } from "../../lib/chart-scale";
import { money } from "../../lib/orders";

type Products = Awaited<ReturnType<typeof hostedData.vendorReport>>["products"];

export const VendorProductDrivers = memo(function VendorProductDrivers({ products }: { products: Products }) {
  const [measure, setMeasure] = useState<ProductMeasure>("revenue");
  const drivers = useMemo(() => productDrivers(products, measure), [products, measure]);
  const top = drivers.ranked.slice(0, 5);
  const ceiling = top.length ? drivers.value(top[0]) : 1;
  const format = (value: number) => (measure === "revenue" ? money(value) : value.toLocaleString("en-MY"));
  return (
    <section className="vendor-mini-chart vendor-product-drivers">
      <header>
        <div>
          <span className="vendor-section-label">WHAT DRIVES SALES?</span>
          <h2>{measure === "revenue" ? "Top revenue drivers" : "Most collected dishes"}</h2>
        </div>
        <div className="vendor-driver-toggle" role="group" aria-label="Rank products by">
          <button type="button" aria-pressed={measure === "revenue"} onClick={() => setMeasure("revenue")}>
            Revenue
          </button>
          <button type="button" aria-pressed={measure === "units"} onClick={() => setMeasure("units")}>
            Portions
          </button>
        </div>
      </header>
      {top.length ? (
        <>
          <p className="vendor-chart-takeaway">
            {cleanMenuName(top[0].name)} contributes {Math.round((drivers.value(top[0]) / drivers.total) * 100)}% of{" "}
            {measure === "revenue" ? "recorded product revenue" : "collected portions"}.
          </p>
          <ol
            className="vendor-driver-rows"
            aria-label={
              measure === "revenue" ? "Products ranked by collected revenue" : "Products ranked by collected portions"
            }
          >
            {top.map((product) => {
              const value = drivers.value(product);
              return (
                <li key={product.id}>
                  <div>
                    <strong>{cleanMenuName(product.name)}</strong>
                    <b>{format(value)}</b>
                  </div>
                  <div className="vendor-driver-track" aria-hidden="true">
                    <i style={{ width: `${(value / ceiling) * 100}%` }} />
                  </div>
                  <div className="vendor-driver-context">
                    <span>
                      {product.units} portions · {Math.round((value / drivers.total) * 100)}% share
                    </span>
                    <span data-low={product.active && product.stock <= 5}>
                      {product.stock === 0 ? "Out of stock" : `${product.stock} in stock`}
                      {!product.active ? " · hidden" : ""}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <p className="vendor-chart-placeholder">Collected sales will show which dishes drive revenue and volume.</p>
      )}
      <footer>
        Top five · share of all listed-menu {measure === "revenue" ? "collected revenue" : "collected portions"}.{" "}
        <Link href="/vendor/menu">Manage menu</Link>
      </footer>
    </section>
  );
});
