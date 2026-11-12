import Link from "next/link";

export function SiteFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer className={"ap-site-footer" + (compact ? " ap-site-footer-compact" : "")}>
      <div className="ap-site-footer-inner">
        <span className="ap-footer-signature">
          APFoods <span>Campus food, on your time.</span>
        </span>
        <nav aria-label="Policies">
          <Link href="/privacy">Privacy policy</Link>
          <Link href="/terms">Terms of use</Link>
          <Link href="/cookies">Cookies</Link>
        </nav>
      </div>
    </footer>
  );
}
