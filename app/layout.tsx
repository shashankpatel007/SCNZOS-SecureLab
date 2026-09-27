import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SCNZOS SecureLab | Practical cybersecurity tools",
    template: "%s | SCNZOS SecureLab",
  },
  description: "Practical cybersecurity tools for everyday users.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        <main>{children}</main>
        <footer className="border-t border-slate-800/80 bg-slate-950/60">
          <div className="shell flex flex-col gap-3 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>SCNZOS SecureLab</p>
            <p>Practical cybersecurity tools for everyday users.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
