"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { Brand } from "../shared";
import { CookiePreferenceControls } from "./cookie-preferences";
import { SiteFooter } from "./footer";
import { clearDemo } from "../../lib/demo-store";

const pages = [
  { id: "privacy", title: "Privacy policy", description: "How we handle your account, orders and personal information." },
  { id: "terms", title: "Terms of use", description: "What to expect when using the APFoods campus pickup prototype." },
  { id: "cookies", title: "Cookies and storage", description: "What stays in your browser, and the controls you have over it." },
];

export function PolicyPage({ page, hosted }: { page: string; hosted: boolean }) {
  const current = pages.find(entry => entry.id === page)!;
  const [cleared, setCleared] = useState(false);
  return <div className="student-theme legal-page">
    <header className="legal-header"><div><Brand /><Link href="/auth/login"><ArrowLeft size={16} aria-hidden />Back to sign in</Link></div></header>
    <main id="main-content" className="legal-main">
      <aside className="legal-navigation"><p>Your information</p><nav aria-label="Policy pages">{pages.map(entry => <Link href={"/" + entry.id} aria-current={page === entry.id ? "page" : undefined} key={entry.id}>{entry.title}<ArrowUpRight size={15} aria-hidden /></Link>)}</nav><span>Clear policies.<br />A better campus experience.</span></aside>
      <article className="legal-document"><header><span className="legal-eyebrow">APFOODS / POLICIES</span><h1>{current.title}</h1><p className="legal-intro">{current.description}</p><div className="legal-draft"><span />Prototype draft · Review before public launch</div></header>
        {page === "privacy" && <>
          <section><h2>The information we keep</h2>{hosted ? <p>Supabase stores your name, email address, account access, saved cart, orders, payment status and operational audit records. Your saved account cart is available on your other devices.</p> : <p>This preview uses fictional orders and cafeteria records stored in your browser. Avoid entering personal information into demo forms.</p>}</section>
          <section><h2>What stays on your device</h2><p>{hosted ? "Guest carts stay in browser storage. Pending checkout details stay in the current tab so you can recover an order after an uncertain response. Session cookies keep you signed in." : "Your browser stores carts, orders, stall settings, scenario selections and changes to the demo ledger. Tabs on the same site share these updates."}</p></section>
          {hosted && <section><h2>Email and merchant images</h2><p>Supabase Auth sends confirmation, recovery and invitation emails through Resend. Merchant names and uploaded payment QR images are stored for checkout and may be publicly accessible. Vendors should upload only a merchant QR intended for customers.</p></section>}
          <section><h2>Recommendations and payments</h2><p>FIF uses stock, pickup availability and order activity to suggest actions. {hosted && "If Gemini is enabled, menu names and prices, aggregated sales and stock signals, your selected weather and audience assumptions, and temporary proposal identifiers may be sent to Google to rank recommendations. Customer names, contact details and payment credentials are not included in these requests. "}Bank account credentials are never requested. Clicking “I've paid” records your payment confirmation; this prototype does not verify it with a bank.</p></section>
          <section><h2>Your data and your choices</h2><p>{hosted ? "Clearing browser data does not delete your account or records in Supabase. Contact the project administrator for account data access or deletion." : "You can reset the browser preview from the storage page. This removes your local changes and restores the fictional starting data."}</p><Link className="legal-text-link" href="/cookies">Manage browser storage<ArrowUpRight size={16} aria-hidden /></Link></section>
        </>}
        {page === "terms" && <>
          <section><h2>About this prototype</h2><p>APFoods is an unofficial campus prototype for demonstrating scheduled food pickup and cafeteria management. These terms are a draft for review before a public launch.</p></section>
          <section><h2>Orders and payments</h2><p>Orders, pickup codes, prices, counter receipts and expenses in this demonstration are fictional. Checkout does not charge money or arrange collection from a real stall. Review your order, pickup time and selected payment method before confirming.</p></section>
          <section><h2>Pickup recommendations</h2><p>Recommendations use kitchen bookings and available capacity. Traffic scenarios describe simulated APFoods activity and do not represent measured physical crowds.</p></section>
          <section><h2>Account access</h2><p>Keep your sign-in details private. Access to vendor and administrator features depends on assigned account permissions. This prototype may change as its features are developed.</p></section>
        </>}
        {page === "cookies" && <>
          <CookiePreferenceControls />
          <section><h2>Essential browser storage</h2><p>{hosted ? "Supabase session cookies keep you signed in. Local storage holds a guest cart and a marker that refreshes carts in other tabs. Session storage holds pending checkout attempts and older carts awaiting import." : "Local browser storage keeps your preview cart, orders, stall settings and demo activity available between visits. The preview does not set sign-in cookies."}</p><p>Optional preference cookies remember list density, display timezone and in-app update settings for 180 days when you allow them. We do not add advertising or analytics cookies.</p></section>
          <section><h2>Ending your session</h2><p>{hosted ? "Sign out from your workspace to end the current browser session. Your account cart and orders remain saved in Supabase." : "Preview sessions stay in the current browser tab. Use Sign out to end your preview session."}</p></section>
          <section className="legal-storage-controls"><div><h2>Clear local demo data</h2><p>{hosted ? "Remove the guest cart and browser demo activity on this device. Your saved account cart and server records are kept. Pending checkout recovery details are retained so an uncertain order can still be recovered." : "Remove your local changes and restore the fictional starting dataset. This action resets the browser demo."}</p></div><button className="button secondary" onClick={() => { if (hosted) { localStorage.removeItem("ap-food-guest-cart"); localStorage.removeItem("ap-food-cart-revision"); } clearDemo(); window.dispatchEvent(new Event("ap-food-cart-changed")); setCleared(true); }}>Clear demo data</button>{cleared && <p className="success" role="status">Local demo data cleared.</p>}</section>
        </>}
        <div className="legal-document-end"><span>APFoods campus prototype</span><Link href="/app">Back to campus food<ArrowUpRight size={15} aria-hidden /></Link></div>
      </article>
    </main><SiteFooter />
  </div>;
}
