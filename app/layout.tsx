import type { Metadata } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { PersistentBackground } from "@/components/persistent-background";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SCNZOS SecureLab | Practical cybersecurity tools",
    template: "%s | SCNZOS SecureLab",
  },
  description: "Simple, private and open source security tools for everyday use.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <PersistentBackground />
        <SiteHeader />
        <main>{children}</main>
        <footer className="site-footer">
          <div className="shell footer-inner">
            <Link href="/" className="footer-brand"><strong>SCNZOS</strong><span>SecureLab</span></Link>
            <nav aria-label="Footer navigation"><Link href="/#tools">Tools</Link><Link href="/about">About</Link><Link href="/privacy">Privacy</Link></nav>
          </div>
          <p className="footer-copyright">© {new Date().getFullYear()} SCNZOS SecureLab</p>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
