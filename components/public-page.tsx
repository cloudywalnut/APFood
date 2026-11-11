"use client";

import { APLanding } from "./apspace/landing";
import { APSpaceHeader } from "./apspace/shell";
import Link from "next/link";
import Image from "next/image";
import { APLogin } from "./apspace/login";
import { useState } from "react";
import { ArrowLeft, ArrowRight, ChefHat, LayoutDashboard, ShoppingBag } from "lucide-react";
import { clearDemo } from "../lib/demo-store";
import { Brand, Footer } from "./shared";
import { HeroDeal, Promotions } from "./promotions";

export function PublicPage({ page }: { page: string }) {
  const [cleared, setCleared] = useState(false);
  const titles: Record<string, string> = { privacy: "Privacy Policy", terms: "Terms and Conditions", cookies: "Cookies and browser storage", login: "Sign in", register: "Student registration" };
  const entrances = [
    { href: "/app", label: "Student", detail: "Browse stalls and schedule pickup", Icon: ShoppingBag },
    { href: "/vendor", label: "Vendor", detail: "Manage the kitchen and menu", Icon: ChefHat },
    { href: "/admin", label: "Admin", detail: "Review cafeteria operations", Icon: LayoutDashboard },
  ];
  if(["home","login","register"].includes(page)) return <APLogin/>;
  return <div className="student-theme public-shell">
    <APSpaceHeader publicView/>
    <main id="main-content" className="student-main public-main">
      {page === "home" ? <>
        <section className="landing-hero">
          <div className="landing-copy"><h1>Campus lunch.<br /><em>Sorted.</em></h1><p>Grab a bowl, kopi, or a quick bite. Choose your pickup time and get back to your day.</p><Link className="button primary" href="/app">Explore campus food <ArrowRight size={18} aria-hidden /></Link></div>
          <div className="landing-image"><Image src="/food/lunch.webp" fill sizes="(max-width: 760px) 100vw, 55vw" alt="Campus lunch with Malaysian chicken and rice" preload /><HeroDeal /></div>
        </section>
        <Promotions />
        <section className="entrance-section"><h2>Explore APFoods</h2><div className="entrances">{entrances.map(({ href, label, detail, Icon }) => <Link href={href} key={href}><Icon size={23} aria-hidden /><span><strong>{label}</strong><small>{detail}</small></span><ArrowRight size={18} aria-hidden /></Link>)}</div></section>
      </> : page === "login" || page === "register" ? <section className="policy">
        <h1>{titles[page]}</h1><p>Choose a workspace to continue.</p>
        <div className="entrances auth-entrances">{entrances.filter(entry => page === "login" || entry.label === "Student").map(({ href, label, detail, Icon }) => <Link key={href} href={href}><Icon size={22} aria-hidden /><span><strong>Continue as {label.toLowerCase()}</strong><small>{detail}</small></span><ArrowRight size={17} aria-hidden /></Link>)}</div>
        <Link className="quiet-link" href={page === "login" ? "/auth/register" : "/auth/login"}>{page === "login" ? "Student registration" : "Back to sign in"}</Link>
      </section> : <article className="policy"><Link href="/" className="page-back-arrow"><ArrowLeft size={17}/>Back to sign in</Link>
        <h1>{titles[page]}</h1>
        {page === "privacy" && <><p>APFoods stores your ordering preferences and activity in this browser.</p><h2>Data on this device</h2><p>The app stores carts, orders, kitchen updates, activity selections, and finance edits in your browser. Tabs on the same site share those changes.</p><h2>Remove saved data</h2><p>Open the Cookies page to reset this browser to the starting records.</p><Link className="button secondary" href="/cookies">Open browser storage settings</Link></>}
        {page === "terms" && <><p>APFoods brings scheduled pickup and cafeteria management into one workspace.</p><h2>Orders and payments</h2><p>Check your order details, pickup time and payment method before confirming. Checkout does not charge your payment card.</p><h2>Pickup recommendations</h2><p>Pickup recommendations use kitchen bookings and capacity. They do not measure physical crowd sizes.</p></>}
        {page === "cookies" && <><p>APFoods keeps your saved activity in browser local storage. The app does not set sign-in or marketing cookies.</p><h2>What is stored</h2><p>Your saved activity includes your cart, orders, stall settings, selected traffic scenario, and changes to the ledger.</p><h2>Reset this browser</h2><p>Clearing saved data removes your changes from this browser and restores the starting records.</p><button className="button primary" onClick={() => { clearDemo(); setCleared(true); }}>Clear data</button>{cleared && <p className="success" role="status">Saved data cleared.</p>}</>}

      </article>}
    </main><Footer />
  </div>;
}
