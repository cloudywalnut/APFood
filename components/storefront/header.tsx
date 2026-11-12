"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Grid2X2,
  House,
  LogIn,
  MapPin,
  MoreHorizontal,
  ReceiptText,
  Search,
  ShoppingBag,
  Store,
} from "lucide-react";
import { AccountMenu } from "../account-menu";
import { BrandLogo, SearchDialog } from "../ui/shell";

const navigation = [
  { href: "/app", label: "Discover", Icon: House },
  { href: "/app/vendors", label: "Campus stalls", Icon: Store },
  { href: "/app/orders", label: "My orders", Icon: ReceiptText },
  { href: "/app/traffic", label: "Current Traffic", Icon: BarChart3 },
  { href: "/app/more", label: "More", Icon: MoreHorizontal },
];

export function StorefrontHeader({
  route,
  cartCount,
  signedIn = true,
}: {
  route: string;
  cartCount: number;
  signedIn?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [tools, setTools] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => setQuery(params.get("dish") ?? ""), [params]);
  useEffect(() => {
    const search = (event: KeyboardEvent) => {
      if (
        event.key === "/" &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement) &&
        !(event.target instanceof HTMLElement && event.target.isContentEditable)
      ) {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", search);
    return () => window.removeEventListener("keydown", search);
  }, []);
  const active = (href: string) =>
    route === href ||
    (href !== "/app" && route.startsWith(href + "/")) ||
    (href === "/app/vendors" && route === "/app/map");
  return (
    <>
      <header className="market-header">
        <div className="market-header-top">
          <BrandLogo href="/app" />
          <Link className="market-location" href="/app/map">
            <MapPin size={19} aria-hidden />
            <span>
              <small>Pick up on campus</small>
              <strong>Campus cafeteria</strong>
            </span>
            <ArrowRight size={14} aria-hidden />
          </Link>
          <div className="market-header-actions">
            <button className="market-tools-button" aria-label="Search workspace tools" onClick={() => setTools(true)}>
              <Grid2X2 size={19} aria-hidden />
            </button>
            {!signedIn ? (
              <Link href={"/auth/login?next=" + encodeURIComponent(route)} className="market-account market-login">
                <LogIn size={18} aria-hidden />
                <span>Log in</span>
              </Link>
            ) : (
              <AccountMenu />
            )}
            <Link href="/app/cart" className="market-cart-link" aria-label={"Cart, " + cartCount + " items"}>
              <ShoppingBag size={20} aria-hidden />
              <span>Basket</span>
              {cartCount > 0 && <b>{cartCount}</b>}
            </Link>
          </div>
        </div>
        <div className="market-header-bottom">
          <nav aria-label="Student navigation">
            {navigation.map(({ href, label, Icon }) => (
              <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}>
                <Icon size={18} aria-hidden />
                {label}
              </Link>
            ))}
          </nav>
          <form
            className="market-search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              router.push("/app/vendors?dish=" + encodeURIComponent(query.trim()));
            }}
          >
            <Search size={19} aria-hidden />
            <input
              ref={input}
              type="search"
              aria-label="Search campus food"
              placeholder="Search stalls, cuisines and dishes"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="submit" aria-label="Search">
              <ArrowRight size={18} aria-hidden />
            </button>
          </form>
        </div>
      </header>
      <nav className="market-mobile-navigation" aria-label="Mobile navigation">
        {navigation.map(({ href, label, Icon }) => (
          <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}>
            <Icon size={20} aria-hidden />
            <span>{label === "Campus stalls" ? "Stalls" : label === "Current Traffic" ? "Traffic" : label}</span>
          </Link>
        ))}
      </nav>
      {tools && <SearchDialog role="student" close={() => setTools(false)} />}
    </>
  );
}
