"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, GitFork } from "lucide-react";
import { DuckMark } from "./DuckMark";

export function Navbar() {
  const isHome = (usePathname() ?? "/") === "/";

  return (
    <header className="site-header">
      <div className="site-container nav-inner">
        <Link href="/" className="brand" aria-label="uDuck Registry home">
          <span className="brand-mark">
            <DuckMark size={36} className="logo-duck" />
          </span>
          <span>
            <span className="brand-wordmark">
              uDuck <em>registry</em>
            </span>
            <span className="brand-subtitle">community moves for Microduck</span>
          </span>
        </Link>

        <nav className="nav-links" aria-label="Primary navigation">
          <Link href="/" className="nav-link" aria-current={isHome ? "page" : undefined}>
            <Compass size={15} aria-hidden="true" />
            <span>Explore</span>
          </Link>
          <a href="https://github.com/ob1-s/uduck-registry/issues/new?template=register-policy.yml" className="nav-link" target="_blank" rel="noopener noreferrer">
            <GitFork size={15} aria-hidden="true" />
            <span>Contribute</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
