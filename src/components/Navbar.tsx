import Link from "next/link";
import { BookOpen, Compass, GitFork } from "lucide-react";
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
            <BookOpen size={15} aria-hidden="true" />
            <span>Docs</span>
          </Link>
          <Link href="/docs/contribute" className="nav-link" aria-label="Contribute a behavior">
            <GitFork size={15} aria-hidden="true" />
            <span>Contribute</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
