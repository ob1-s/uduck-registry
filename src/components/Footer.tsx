import Link from "next/link";
import { DuckMark } from "./DuckMark";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-container footer-compact">
        <div className="footer-compact-brand">
          <DuckMark size={27} />
          <span>uDuck <em>registry</em></span>
        </div>

        <p className="footer-compact-copy">
          Community moves for MicroDuck, with the links and evidence kept close to the work.
        </p>

        <nav className="footer-compact-links" aria-label="Footer navigation">
          <Link href="/docs/specification">Contract</Link>
          <Link href="/docs/schema">Schema</Link>
          <Link href="/docs/contribute">Contribute</Link>
          <Link href="/registry.json" target="_blank" rel="noopener noreferrer" aria-label="Open registry JSON in a new tab">JSON</Link>
          <a href="https://github.com/ob1-s/awesome-microduck" target="_blank" rel="noopener noreferrer" aria-label="Open Awesome Microduck in a new tab">Awesome ↗</a>
          <a href="https://pollen-robotics.com/microduck" target="_blank" rel="noopener noreferrer" aria-label="Open the MicroDuck product page in a new tab">MicroDuck ↗</a>
        </nav>

        <p className="footer-compact-meta">
          Independent community project · not affiliated with Pollen Robotics or Hugging Face · Apache 2.0
        </p>
      </div>
    </footer>
  );
}
