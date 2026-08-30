import { ArrowRight } from "lucide-react";
import { getAllBehaviors, getRegistryStats } from "@/lib/registry";
import { BehaviorCatalog } from "@/components/BehaviorCatalog";
import { InteractiveDuck } from "@/components/InteractiveDuck";
import { QuackAnchor, QuackLink } from "@/components/QuackAction";

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
              <QuackAnchor href="#catalog" className="button-primary">Choose a behavior <ArrowRight size={15} aria-hidden="true" /></QuackAnchor>
            </div>
            <p className="hero-meta"><span className="hero-meta-dot" /> {stats.total} moves · {stats.hardware} marked hardware-verified</p>
          </div>

          <div className="hero-art">
            <div className="hero-figure-ring hero-figure-ring-back" aria-hidden="true" />
            <div className="hero-figure-ring hero-figure-ring-front" aria-hidden="true" />
            <div className="hero-figure">
              <InteractiveDuck />
              <span className="hero-figure-label">walk · roll · recover</span>
            </div>
            <span className="hero-sticker hero-sticker-left" aria-hidden="true">quack!</span>
            <span className="hero-sticker hero-sticker-right" aria-hidden="true">{stats.hardware} verified</span>
          </div>
        </div>
      </section>

      <div className="ticker" aria-hidden="true">
        <div className="ticker-track">
          {[0, 1].map((copy) => (
            <div className="ticker-group" key={copy}>
              <span>{stats.total} moves in the shelf</span><i>◆</i>
              <span>{stats.hardware} marked hardware-verified</span><i>◆</i>
              <span>{stats.community} experimental</span><i>◆</i>
              <span>standard+rollers+ball</span><i>◆</i>
              <span>ONNX</span><i>◆</i>
              <span>contract</span><i>◆</i>
            </div>
          ))}
        </div>
      </div>

      <section id="catalog" className="section catalog-section" aria-labelledby="catalog-heading">
        <div className="site-container">
          <div className="section-heading catalog-heading">
            <div>
              <span className="eyebrow">Behavior library</span>
              <h2 id="catalog-heading">Choose a starting point.</h2>
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
          <QuackLink href="/docs/contribute" className="button-secondary">Read the contributor guide <ArrowRight size={15} aria-hidden="true" /></QuackLink>
        </div>
      </section>
    </>
  );
}
