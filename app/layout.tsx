import { PreferenceCookies } from "../components/legal/cookie-preferences";
import { HostedSessionProvider } from "../components/hosted/session-provider";
import { ToastOutlet } from "../components/ui/toasts";
import type { Metadata } from "next";
import "./globals.css";
import "./account-menu.css";
import "./storefront.css";
import "./ui.css";
import "./cafeteria.css";
import "./refinement.css";
import "./auth-pages.css";
import "./marketplace.css";
import "./cart.css";
import "./traffic.css";
import "./cookies.css";
import "./ui-review-fixes.css";
import "./vendor-operations.css";
import "./vendor-scenarios.css";
import "./vendor-sales.css";
import "./vendor-density.css";
import "./vendor-analytics.css";
import "./vendor-dashboard.css";

export const metadata: Metadata = {
  title: "APFoods · Campus pickup",
  description: "Browse campus food stalls, schedule pickup, and explore the cafeteria.",
  icons: { icon: "/brand/ap-monogram-v2.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" href="/fonts/roboto-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>
        <a className="skip" href="#main-content">
          Skip to content
        </a>
        <HostedSessionProvider>{children}</HostedSessionProvider>
        <ToastOutlet />
        <PreferenceCookies />
      </body>
    </html>
  );
}
