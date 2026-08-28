import Link from "next/link";
import { ArrowRight, BookOpen, Code2, GitFork, ShieldCheck, Sparkles, Waypoints } from "lucide-react";
import { getAllBehaviors, getRegistryStats } from "@/lib/registry";
import { BehaviorCatalog } from "@/components/BehaviorCatalog";
import { DuckMark } from "@/components/DuckMark";

export default function HomePage() {
  const behaviors = getAllBehaviors();
  const stats = getRegistryStats();

  return (
    <>
      <section className="hero">
        <div className="site-container hero-layout">
          <div>
            <span className="eyebrow">Microduck / behavior shelf</span>
            <h1 className="display">Good moves, <span className="display-accent">shared.</span></h1>
            <p className="lede">
              Browse small, useful behavior policies for <strong>Microduck</strong>. Find a gait, inspect the contract, and follow the recipe to your robot.
            </p>
            <div className="button-row">
              <a href="#catalog" className="button-primary">
                Browse behaviors <ArrowRight size={15} aria-hidden="true" />
              </a>
              <Link href="/docs/specification" className="button-secondary">
                Read the contract <BookOpen size={15} aria-hidden="true" />
              </Link>
            </div>
            <div className="hero-terminal" aria-label="Machine-readable registry endpoint">
              <Code2 size={14} aria-hidden="true" />
              <code>GET /registry.json</code>
              <span className="terminal-comment">· {stats.total} recipes</span>
            </div>

            <div className="stats-row" aria-label="Registry statistics">
              <div className="stat-card"><strong>{stats.total}</strong><span>behaviors</span></div>
              <div className="stat-card"><strong>{stats.hardware}</strong><span>hardware verified</span></div>
              <div className="stat-card"><strong>{stats.sim}</strong><span>simulation tested</span></div>
              <div className="stat-card"><strong>61 / 14</strong><span>input / joints</span></div>
            </div>
          </div>

          <div className="hero-art" aria-hidden="true">
            <div className="hero-orbit" />
            <div className="hero-note">
              <div className="hero-note-top">
                <span className="hero-note-label">Today&apos;s little note</span>
                <span className="hero-note-pin" />
              </div>
              <DuckMark size={92} className="duck-scribble" />
              <div>
                <h2>A duck can learn a lot of ways to get around.</h2>
                <p>Every card links to its source, status, and the exact runtime details it expects.</p>
              </div>
              <div className="hero-note-bottom">
                <div className="hero-note-stat"><strong>50 Hz</strong><span>shared rhythm</span></div>
                <div className="hero-note-stat"><strong>1 file</strong><span>per behavior</span></div>
                <Sparkles size={18} color="var(--sun-dark)" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="catalog" className="section">
        <div className="site-container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">The catalog</span>
              <h2>Pick a move</h2>
              <p>Gaits, tricks, recoveries, and more. Each recipe keeps its provenance and compatibility details close by.</p>
            </div>
            <span className="section-note">Updated from the local registry</span>
          </div>
          <BehaviorCatalog initialBehaviors={behaviors} />
        </div>
      </section>

      <section className="section principles">
        <div className="site-container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">A few good rules</span>
              <h2>Useful by design</h2>
              <p>Small manifests, clear evidence, and links that lead back to the work.</p>
            </div>
          </div>
          <div className="principle-grid">
            <article className="surface principle-card">
              <div className="principle-icon principle-icon-pond"><Waypoints size={17} aria-hidden="true" /></div>
              <h3>One shared contract</h3>
              <p>Every listed policy declares its observation size, action layout, timing, and robot slot.</p>
            </article>
            <article className="surface principle-card">
              <div className="principle-icon principle-icon-sun"><ShieldCheck size={17} aria-hidden="true" /></div>
              <h3>Evidence with the label</h3>
              <p>Hardware runs, simulations, claims, and experiments are visibly different at a glance.</p>
            </article>
            <article className="surface principle-card">
              <div className="principle-icon principle-icon-sky"><GitFork size={17} aria-hidden="true" /></div>
              <h3>Sources stay upstream</h3>
              <p>The registry points to canonical artifacts so authorship, updates, and context remain intact.</p>
            </article>
          </div>
          <div className="button-row">
            <Link href="/docs/contribute" className="button-secondary">Add a behavior <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
        </div>
      </section>
    </>
  );
}
