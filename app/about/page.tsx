import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "@/components/info-page";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return <InfoPage eyebrow="About SecureLab" title="Useful security tools for ordinary moments." intro="SCNZOS SecureLab is a small, focused collection of cybersecurity utilities for people who want a clearer view of the files, images, and links they use every day." sections={[
    { title: "Why SecureLab", children: <p>Everyday privacy decisions are often hidden behind technical details. SecureLab exists to make those decisions easier to understand, with simple interfaces that help you check what you are about to share or open.</p> },
    { title: "Our approach", children: <><p>Privacy is part of the product design. Where technically possible, tools are intended to process inputs in the browser, without an account and without collecting more information than the task requires.</p><p>The current tool pages are interface foundations. Their analysis actions are not active yet, so no uploaded file, image, or URL is processed by this implementation.</p></> },
    { title: "Tools", children: <div className="info-tool-list"><Link href="/tools/file-privacy-inspector"><strong>File Privacy Inspector</strong><span>Inspect privacy-sensitive metadata before sharing files.</span></Link><Link href="/tools/screenshot-privacy-cleaner"><strong>Screenshot Privacy Cleaner</strong><span>Find sensitive information in screenshots before sharing.</span></Link><Link href="/tools/url-redirect-visualizer"><strong>URL Redirect Visualizer</strong><span>See where a URL redirects before opening it.</span></Link></div> },
    { title: "Open and security focused", children: <p>SecureLab is built as a straightforward, inspectable web project. The goal is to keep the interface calm, the data footprint small, and the tools useful without unnecessary accounts or services.</p> },
  ]} />;
}
