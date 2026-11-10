import type { Metadata } from "next";
import "./globals.css";
import "./storefront.css";

export const metadata: Metadata = {
  title: "AP Food · Campus pickup",
  description: "Browse campus food stalls, schedule pickup, and explore the cafeteria demo.",
  icons: { icon: "/ap-food-mark.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a className="skip" href="#main-content">Skip to content</a>{children}</body></html>;
}
