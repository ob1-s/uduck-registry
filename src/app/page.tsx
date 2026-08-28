import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getAllBehaviors, getRegistryStats } from "@/lib/registry";
import { BehaviorCatalog } from "@/components/BehaviorCatalog";
import { DuckMark } from "@/components/DuckMark";

export default function HomePage() {
  const behaviors = getAllBehaviors();
  const stats = getRegistryStats();

  return (
    <>
      <section className="hero hero-quiet">
        <div className="site-container hero-layout">
          <div className="hero-copy">
            <span className="eyebrow">uDuck / for Microduck</span>
            <h1 className="display">Teach your duck a <span className="display-accent">new move.</span></h1>
            <p className="lede">
              A small library of community moves for Microduck. Pick one, see what it needs, and open the source.
            </p>
            <div className="button-row">
              <a href="#catalog" className="button-primary">Choose a behavior <ArrowRight size={15} aria-hidden="true" /></a>
            </div>
            <p className="hero-meta"><span className="hero-meta-dot" /> {stats.total} moves · {stats.hardware} marked hardware-tested</p>
          </div>

          <div className="hero-art" aria-hidden="true">
            <div className="hero-figure-ring hero-figure-ring-back" />
            <div className="hero-figure-ring hero-figure-ring-front" />
            <div className="hero-figure">
              <DuckMark size={168} />
              <span className="hero-figure-label">walk · roll · recover</span>
            </div>
            <span className="hero-sticker hero-sticker-left">hello!</span>
            <span className="hero-sticker hero-sticker-right">50 Hz</span>
          </div>
        </div>
      </section>

      <section id="catalog" className="section catalog-section">
        <div className="site-container">
          <div className="section-heading catalog-heading">
            <div>
              <span className="eyebrow">Behavior library</span>
              <h2>Choose a starting point.</h2>
              <p>Search the shelf, then open a move for its contract and run instructions.</p>
            </div>
            <span className="section-note">{stats.total} moves</span>
          </div>
          <BehaviorCatalog initialBehaviors={behaviors} />
        </div>
      </section>

      <section className="share-strip">
        <div className="site-container share-strip-inner">
          <div><span className="eyebrow">Have a new move?</span><h2>Add it to the shelf.</h2></div>
          <Link href="/docs/contribute" className="button-secondary">Read the contributor guide <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
      </section>
    </>
  );
}
