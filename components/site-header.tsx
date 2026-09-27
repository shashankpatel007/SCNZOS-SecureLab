import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link href="/" className="wordmark" aria-label="SCNZOS SecureLab home">
          <span>SCNZOS</span><span className="wordmark-divider" aria-hidden="true" /><span className="wordmark-subtitle">SecureLab</span>
        </Link>
        <nav aria-label="Main navigation" className="header-nav">
          <Link href="/#tools">Tools</Link>
          <Link href="/about">About</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>
      </div>
    </header>
  );
}
