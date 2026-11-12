"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { Brand } from "../shared";
import { CookiePreferenceControls } from "./cookie-preferences";
import { SiteFooter } from "./footer";

const pages = [
  {
    id: "privacy",
    title: "Privacy policy",
    description: "How we handle your account, orders and personal information.",
  },
  { id: "terms", title: "Terms of use", description: "What to expect when using the APFoods campus pickup prototype." },
  {
    id: "cookies",
    title: "Cookies and storage",
    description: "What stays in your browser, and the controls you have over it.",
  },
];

export function PolicyPage({ page }: { page: string }) {
  const current = pages.find((entry) => entry.id === page)!;
  const [cleared, setCleared] = useState(false);
  return (
    <div className="student-theme legal-page">
      <header className="legal-header">
        <div>
          <Brand />
          <Link href="/auth/login">
            <ArrowLeft size={16} aria-hidden />
            Back to sign in
          </Link>
        </div>
      </header>
      <main id="main-content" className="legal-main">
        <aside className="legal-navigation">
          <p>Your information</p>
          <nav aria-label="Policy pages">
            {pages.map((entry) => (
              <Link href={"/" + entry.id} aria-current={page === entry.id ? "page" : undefined} key={entry.id}>
                {entry.title}
                <ArrowUpRight size={15} aria-hidden />
              </Link>
            ))}
          </nav>
          <span>
            Clear policies.
            <br />A better campus experience.
          </span>
        </aside>
        <article className="legal-document">
          <header>
            <span className="legal-eyebrow">APFOODS / POLICIES</span>
            <h1>{current.title}</h1>
            <p className="legal-intro">{current.description}</p>
            <div className="legal-draft">
              <span />
              Prototype draft · Review before public launch
            </div>
          </header>
          {page === "privacy" && (
            <>
              <section>
                <h2>The information we keep</h2>
                <p>
                  Supabase stores your name, email address, account access, saved cart, orders, payment status and
                  operational audit records. Your saved account cart is available on your other devices.
                </p>
              </section>
              <section>
                <h2>What stays on your device</h2>
                <p>
                  {
                    "Guest carts stay in browser storage. Pending checkout details stay in the current tab so you can recover an order after an uncertain response. Session cookies keep you signed in."
                  }
                </p>
              </section>
              <section>
                <h2>Email and merchant images</h2>
                <p>
                  Supabase Auth sends confirmation, recovery and invitation emails through Resend. Merchant names and
                  uploaded payment QR images are stored for checkout and may be publicly accessible. Vendors should
                  upload only a merchant QR intended for customers.
                </p>
              </section>
              <section>
                <h2>Recommendations and payments</h2>
                <p>
                  FIF uses stock, pickup availability and order activity to suggest actions.{" "}
                  {
                    "If Gemini ranking is enabled, only aggregate numbers and temporary action identifiers are sent to Google. "
                  }
                  Bank account credentials are never requested. Clicking “I've paid” records your payment confirmation;
                  this prototype does not verify it with a bank.
                </p>
              </section>
              <section>
                <h2>Your data and your choices</h2>
                <p>
                  {
                    "Clearing browser data does not delete your account or records in Supabase. Contact the project administrator for account data access or deletion."
                  }
                </p>
                <Link className="legal-text-link" href="/cookies">
                  Manage browser storage
                  <ArrowUpRight size={16} aria-hidden />
                </Link>
              </section>
            </>
          )}
          {page === "terms" && (
            <>
              <section>
                <h2>About this prototype</h2>
                <p>
                  APFoods is an unofficial campus prototype for demonstrating scheduled food pickup and cafeteria
                  management. These terms are a draft for review before a public launch.
                </p>
              </section>
              <section>
                <h2>Orders and payments</h2>
                <p>
                  Orders, pickup codes, prices, counter receipts and expenses in this demonstration are fictional.
                  Checkout does not charge money or arrange collection from a real stall. Review your order, pickup time
                  and selected payment method before confirming.
                </p>
              </section>
              <section>
                <h2>Pickup recommendations</h2>
                <p>
                  Recommendations use kitchen bookings and available capacity. Traffic figures come from pickups booked
                  in APFoods and do not represent measured physical crowds.
                </p>
              </section>
              <section>
                <h2>Account access</h2>
                <p>
                  Keep your sign-in details private. Access to vendor and administrator features depends on assigned
                  account permissions. This prototype may change as its features are developed.
                </p>
              </section>
            </>
          )}
          {page === "cookies" && (
            <>
              <CookiePreferenceControls />
              <section>
                <h2>Essential browser storage</h2>
                <p>
                  {
                    "Supabase session cookies keep you signed in. Local storage holds a guest cart and a marker that refreshes carts in other tabs. Session storage holds pending checkout attempts."
                  }
                </p>
                <p>
                  Optional preference cookies remember list density, display timezone and in-app update settings for 180
                  days when you allow them. We do not add advertising or analytics cookies.
                </p>
              </section>
              <section>
                <h2>Ending your session</h2>
                <p>
                  {
                    "Sign out from your workspace to end the current browser session. Your account cart and orders remain saved in Supabase."
                  }
                </p>
              </section>
              <section className="legal-storage-controls">
                <div>
                  <h2>Clear local data</h2>
                  <p>
                    {
                      "Remove the guest cart saved on this device. Your saved account cart and server records are kept. Pending checkout recovery details are retained so an uncertain order can still be recovered."
                    }
                  </p>
                </div>
                <button
                  className="button secondary"
                  onClick={() => {
                    localStorage.removeItem("ap-food-guest-cart");
                    localStorage.removeItem("ap-food-cart-revision");
                    window.dispatchEvent(new Event("ap-food-cart-changed"));
                    setCleared(true);
                  }}
                >
                  Clear local data
                </button>
                {cleared && (
                  <p className="success" role="status">
                    Local data cleared.
                  </p>
                )}
              </section>
            </>
          )}
          <div className="legal-document-end">
            <span>APFoods campus prototype</span>
            <Link href="/app">
              Back to campus food
              <ArrowUpRight size={15} aria-hidden />
            </Link>
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
