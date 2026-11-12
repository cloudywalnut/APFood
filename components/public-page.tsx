"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ChefHat, LayoutDashboard, ShoppingBag } from "lucide-react";
import { PolicyPage } from "./legal/policy-page";
import { Brand, Footer } from "./shared";

const entrances = [
  { href: "/app", label: "Student", detail: "Browse stalls and schedule pickup", Icon: ShoppingBag },
  { href: "/vendor", label: "Vendor", detail: "Manage the kitchen and menu", Icon: ChefHat },
  { href: "/admin", label: "Admin", detail: "Review cafeteria operations", Icon: LayoutDashboard },
];

export function PublicPage({ page }: { page: string }) {
  if (["privacy", "terms", "cookies"].includes(page)) return <PolicyPage page={page} />;
  return (
    <div className="student-theme public-shell">
      <header className="student-header">
        <div className="student-bar">
          <Brand />
          <Link className="quiet-link" href="/auth/login">
            Sign in <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </header>
      <main id="main-content" className="student-main public-main">
        <section className="landing-hero">
          <div className="landing-copy">
            <h1>
              Campus lunch.
              <br />
              <em>Sorted.</em>
            </h1>
            <p>Grab a bowl, kopi, or a quick bite. Choose your pickup time and get back to your day.</p>
            <Link className="button primary" href="/app">
              Explore campus food <ArrowRight size={18} aria-hidden />
            </Link>
            <span className="landing-note">Campus pickup demo · Powered by FIF</span>
          </div>
          <div className="landing-image">
            <Image
              src="/food/lunch.webp"
              fill
              sizes="(max-width: 760px) 100vw, 55vw"
              alt="Campus lunch with Malaysian chicken and rice"
              preload
            />
          </div>
        </section>
        <section className="entrance-section">
          <h2>Explore the demo</h2>
          <div className="entrances">
            {entrances.map(({ href, label, detail, Icon }) => (
              <Link href={href} key={href}>
                <Icon size={23} aria-hidden />
                <span>
                  <strong>{label}</strong>
                  <small>{detail}</small>
                </span>
                <ArrowRight size={18} aria-hidden />
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
