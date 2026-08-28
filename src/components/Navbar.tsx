import Link from "next/link";
import { BookOpen, Code2, Compass, GitFork, ShieldCheck } from "lucide-react";
import { DuckMark } from "./DuckMark";

export function Navbar() {
  return (
    <header className="site-header">
      <div className="site-container nav-inner">
        <Link href="/" className="brand" aria-label="uDuck Registry home">
          <span className="brand-mark">
            <DuckMark size={36} />
          </span>
          <span>
            <span className="brand-wordmark">
              uDuck <em>registry</em>
            </span>
            <span className="brand-subtitle">behaviors for Microduck</span>
          </span>
        </Link>

        <nav className="nav-links" aria-label="Primary navigation">
          <Link href="/" className="nav-link" aria-label="Explore behaviors">
            <Compass size={15} aria-hidden="true" />
            <span>Explore</span>
          </Link>
          <Link href="/docs/specification" className="nav-link" aria-label="Read the runtime contract">
            <ShieldCheck size={15} aria-hidden="true" />
            <span>Contract</span>
          </Link>
          <Link href="/docs/schema" className="nav-link" aria-label="Read the manifest schema">
            <BookOpen size={15} aria-hidden="true" />
            <span>Schema</span>
          </Link>
          <Link href="/docs/contribute" className="nav-link" aria-label="Contribute a behavior">
            <GitFork size={15} aria-hidden="true" />
            <span>Contribute</span>
          </Link>
          <Link
            href="/registry.json"
            target="_blank"
            className="nav-endpoint"
            title="Open the machine-readable registry"
          >
            <Code2 size={13} aria-hidden="true" />
            <span>JSON</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
