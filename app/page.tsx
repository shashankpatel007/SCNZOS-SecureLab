import Link from "next/link";
import { ArrowUpRightIcon } from "@/components/icons";
import { tools } from "@/lib/tools";

export default function HomePage() {
  return (
    <div className="shell home-page">
      <section className="home-intro" aria-labelledby="home-title">
        <h1 id="home-title">Security tools<br />for everyday use.</h1>
        <p>Simple, private and open source.</p>
        <span className="intro-rule" aria-hidden="true" />
      </section>

      <section id="tools" className="tool-list" aria-label="Security tools">
        {tools.map((tool) => (
          <Link className="tool-card" href={`/tools/${tool.slug}`} key={tool.slug}>
            <span className="tool-card-title">{tool.name}<ArrowUpRightIcon className="tool-card-arrow" /></span>
            <span className="tool-card-description">{tool.description}</span>
          </Link>
        ))}
      </section>

      <section id="about" className="about-note">
        <p>Useful, focused tools for understanding the files, images and links you share.</p>
      </section>
    </div>
  );
}
