import { PreviewGate } from "../components/apspace/login";
import { ContextHelp } from "../components/apspace/context-help";
import { ToastOutlet } from "../components/apspace/toasts";
import type { Metadata } from "next";
import "./globals.css";
import "./storefront.css";
import "./apspace.css";
import "./cafeteria.css";
import "./refinement.css";

export const metadata: Metadata = {
  title: "APFoods · Campus pickup",
  description: "Browse campus food stalls, schedule pickup, and explore the cafeteria sample.",
  icons: { icon: "/ap-food-mark.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><head><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/><link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700&display=swap" rel="stylesheet"/></head><body><a className="skip" href="#main-content">Skip to content</a><PreviewGate>{children}</PreviewGate><ToastOutlet/><ContextHelp/></body></html>;
}
