import { PreviewGate } from "../components/apspace/login";
import { PreferenceCookies } from "../components/legal/cookie-preferences";
import { ToastOutlet } from "../components/apspace/toasts";
import type { Metadata } from "next";
import "./globals.css";
import "./storefront.css";
import "./apspace.css";
import "./cafeteria.css";
import "./refinement.css";
import "./auth-pages.css";
import "./marketplace.css";
import "./cart.css";
import "./traffic.css";
import "./cookies.css";

export const metadata: Metadata = {
  title: "APFoods · Campus pickup",
  description: "Browse campus food stalls, schedule pickup, and explore the cafeteria.",
  icons: { icon: "/brand/ap-monogram-v2.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><head><link rel="preload" href="/fonts/roboto-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous"/></head><body><a className="skip" href="#main-content">Skip to content</a>{process.env.AP_FOOD_DATA_MODE === 'supabase' ? children : <PreviewGate>{children}</PreviewGate>}<ToastOutlet/><PreferenceCookies/></body></html>;
}
