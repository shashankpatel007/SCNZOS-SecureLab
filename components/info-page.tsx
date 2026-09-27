import Link from "next/link";

type InfoSection = {
  title: string;
  children: React.ReactNode;
};

export function InfoPage({ eyebrow, title, intro, sections }: { eyebrow: string; title: string; intro: string; sections: InfoSection[] }) {
  return (
    <div className="shell info-page">
      <Link href="/" className="back-link"><span aria-hidden="true">←</span> Home</Link>
      <header className="info-heading">
        <p className="info-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="info-intro">{intro}</p>
      </header>
      <div className="info-content">
        {sections.map((section) => <section className="info-section" key={section.title}><h2>{section.title}</h2><div className="info-section-body">{section.children}</div></section>)}
      </div>
    </div>
  );
}
