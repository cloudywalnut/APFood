"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ChefHat, LayoutDashboard, ShoppingBag } from "lucide-react";
import { PolicyPage } from "./legal/policy-page";
import { Brand, Footer } from "./shared";
import { HeroDeal, Promotions } from "./promotions";
import { APLogin } from "./apspace/login";

export function PublicPage({ page, hosted = false }: { page: string; hosted?: boolean }) {
  if (["privacy", "terms", "cookies"].includes(page)) return <PolicyPage page={page} hosted={hosted} />;
  if (!hosted && ["home", "login", "register"].includes(page)) return <APLogin />;
  const titles: Record<string, string> = { privacy: "Privacy Policy", terms: "Terms and Conditions", cookies: "Cookies and browser storage", login: "Sign in", register: "Student registration" };
  const entrances = [
    { href: "/app", label: "Student", detail: "Browse stalls and schedule pickup", Icon: ShoppingBag },
    { href: "/vendor", label: "Vendor", detail: "Manage the kitchen and menu", Icon: ChefHat },
    { href: "/admin", label: "Admin", detail: "Review cafeteria operations", Icon: LayoutDashboard },
  ];
  return <div className="student-theme public-shell">
    <header className="student-header"><div className="student-bar"><Brand /><Link className="quiet-link" href="/auth/login">{hosted ? "Sign in" : "Demo entrances"} <ArrowRight size={16} aria-hidden /></Link></div></header>
    <main id="main-content" className="student-main public-main">
      {page === "home" ? <>
        <section className="landing-hero">
          <div className="landing-copy"><h1>Campus lunch.<br /><em>Sorted.</em></h1><p>Grab a bowl, kopi, or a quick bite. Choose your pickup time and get back to your day.</p><Link className="button primary" href="/app">Explore campus food <ArrowRight size={18} aria-hidden /></Link><span className="landing-note">Campus pickup demo · Powered by FIF</span></div>
          <div className="landing-image"><Image src="/food/lunch.webp" fill sizes="(max-width: 760px) 100vw, 55vw" alt="Campus lunch with Malaysian chicken and rice" preload />{!hosted && <HeroDeal />}</div>
        </section>
        {!hosted && <Promotions />}
        <section className="entrance-section"><h2>Explore the demo</h2><div className="entrances">{entrances.map(({ href, label, detail, Icon }) => <Link href={href} key={href}><Icon size={23} aria-hidden /><span><strong>{label}</strong><small>{detail}</small></span><ArrowRight size={18} aria-hidden /></Link>)}</div></section>
      </> : page === "login" || page === "register" ? <section className="policy">
        <h1>{titles[page]}</h1><p>This prototype uses fictional demo personas. Choose a workspace to continue.</p>
        <div className="entrances auth-entrances">{entrances.filter(entry => page === "login" || entry.label === "Student").map(({ href, label, detail, Icon }) => <Link key={href} href={href}><Icon size={22} aria-hidden /><span><strong>Continue as {label.toLowerCase()}</strong><small>{detail}</small></span><ArrowRight size={17} aria-hidden /></Link>)}</div>
        <Link className="quiet-link" href={page === "login" ? "/auth/register" : "/auth/login"}>{page === "login" ? "Student registration" : "Back to sign in"}</Link>
      </section> : null}
    </main><Footer />
  </div>;
}
