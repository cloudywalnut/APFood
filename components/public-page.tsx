"use client";

import { APLanding } from "./apspace/landing";
import { APSpaceHeader } from "./apspace/shell";
import Link from "next/link";
import Image from "next/image";
import { APLogin } from "./apspace/login";
import { useState } from "react";
import { ArrowRight, ChefHat, LayoutDashboard, ShoppingBag } from "lucide-react";
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
          <div className="landing-copy"><h1>Campus lunch.<br /><em>Sorted.</em></h1><p>Grab a bowl, kopi, or a quick bite. Choose your pickup time and get back to your day.</p><Link className="button primary" href="/app">Explore campus food <ArrowRight size={18} aria-hidden /></Link><span className="landing-note">Campus pickup sample · Powered by FIF</span></div>
          <div className="landing-image"><Image src="/food/lunch.webp" fill sizes="(max-width: 760px) 100vw, 55vw" alt="Campus lunch with Malaysian chicken and rice" preload /><HeroDeal /></div>
        </section>
        <Promotions />
        <section className="entrance-section"><h2>Explore the sample</h2><div className="entrances">{entrances.map(({ href, label, detail, Icon }) => <Link href={href} key={href}><Icon size={23} aria-hidden /><span><strong>{label}</strong><small>{detail}</small></span><ArrowRight size={18} aria-hidden /></Link>)}</div></section>
      </> : page === "login" || page === "register" ? <section className="policy">
        <h1>{titles[page]}</h1><p>This prototype uses fictional sample personas. Choose a workspace to continue.</p>
        <div className="entrances auth-entrances">{entrances.filter(entry => page === "login" || entry.label === "Student").map(({ href, label, detail, Icon }) => <Link key={href} href={href}><Icon size={22} aria-hidden /><span><strong>Continue as {label.toLowerCase()}</strong><small>{detail}</small></span><ArrowRight size={17} aria-hidden /></Link>)}</div>
        <Link className="quiet-link" href={page === "login" ? "/auth/register" : "/auth/login"}>{page === "login" ? "Student registration" : "Back to sign in"}</Link>
      </section> : <article className="policy">
        <span className="badge neutral">Prototype draft</span><h1>{titles[page]}</h1>
        {page === "privacy" && <><p>This prototype runs with fictional orders and cafeteria data. Avoid entering personal information in sample forms.</p><h2>Data on this device</h2><p>The app stores sample carts, orders, kitchen updates, scenario selections, and finance edits in your browser. Tabs on the same site share those changes.</p><h2>Remove sample data</h2><p>Open the Cookies page to reset this browser to the original sample data.</p><Link className="button secondary" href="/cookies">Open browser storage settings</Link></>}
        {page === "terms" && <><p>APFoods is an unofficial campus prototype for demonstrating scheduled pickup and cafeteria management.</p><h2>Orders and payments</h2><p>Orders, pickup codes, prices, counter receipts, and expenses are fictional. Sample checkout does not charge money or arrange collection from a real stall.</p><h2>Pickup recommendations</h2><p>Traffic scenarios describe simulated APFoods activity. They do not represent measured physical crowds.</p></>}
        {page === "cookies" && <><p>APFoods keeps the sample in browser local storage. The app does not set sign-in or marketing cookies.</p><h2>What is stored</h2><p>The <code>ap-food-apspace-demo-v1</code> key holds your sample cart, orders, stall settings, selected traffic scenario, and changes to the sample ledger.</p><h2>Reset this browser</h2><p>Clearing sample data removes your changes from this browser and restores the fictional starting dataset.</p><button className="button primary" onClick={() => { clearDemo(); setCleared(true); }}>Clear sample data</button>{cleared && <p className="success" role="status">Sample data cleared.</p>}</>}
        <p className="muted">Draft for review before a public launch.</p>
      </article>}
    </main><Footer />
  </div>;
}
