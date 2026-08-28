import Link from "next/link";
import { getAllBehaviors, getRegistryStats } from "@/lib/registry";
import { BehaviorCatalog } from "@/components/BehaviorCatalog";
import {
  Cpu,
  ShieldCheck,
  Zap,
  Terminal,
  ArrowRight,
  GitFork,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

export default function HomePage() {
  const behaviors = getAllBehaviors();
  const stats = getRegistryStats();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-800/80 bg-gradient-to-b from-slate-950 via-[#0b101d] to-[#090d16] py-16 sm:py-24 robot-grid">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            {/* Tagline Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-mono text-amber-300 mb-6">
              <span>🦆</span>
              <span>uDuck Registry · community behaviors for MicroDuck</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white">
              Discover what people have{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-500">
                taught the duck.
              </span>
            </h1>

            <p className="mt-5 text-base sm:text-lg text-slate-300 leading-relaxed">
              A lightweight, community-first registry for{" "}
              <strong className="text-white font-semibold">MicroDuck</strong> neural policies,
              training environments, and behaviors. We index canonical ONNX artifacts, contracts,
              and sim2real provenance without re-inventing upstream infrastructure.
            </p>

            {/* Quick Actions */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#catalog"
                className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-amber-300 transition-colors shadow-lg shadow-amber-400/20"
              >
                <span>Browse Behaviors</span>
                <ArrowRight className="h-4 w-4" />
              </a>

              <Link
                href="/docs/specification"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-750 bg-slate-900/80 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <Cpu className="h-4 w-4 text-emerald-400" />
                <span>Contract Spec</span>
              </Link>

              <Link
                href="/docs/contribute"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-750 bg-slate-900/80 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <GitFork className="h-4 w-4 text-purple-400" />
                <span>Submit Policy</span>
              </Link>
            </div>

            {/* Quick Terminal Snippet */}
            <div className="mt-8 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-2.5 font-mono text-xs text-slate-400 max-w-xl">
              <Terminal className="h-4 w-4 text-amber-400 shrink-0" />
              <span className="text-slate-500 select-none">$</span>
              <span className="text-slate-300">curl -s https://uduck.dev/registry.json | jq .count</span>
              <span className="ml-auto text-amber-400/90 select-none"># 16 policies</span>
            </div>
          </div>

          {/* Key Metrics Strip */}
          <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-slate-800/80 pt-8">
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4">
              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
                {stats.total}
              </div>
              <div className="text-xs text-slate-400 mt-1">Behaviors Indexed</div>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4">
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">
                {stats.hardware}
              </div>
              <div className="text-xs text-slate-400 mt-1">Verified on Real Robot</div>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4">
              <div className="text-2xl sm:text-3xl font-extrabold text-cyan-400 font-mono">
                {stats.sim + stats.claimed}
              </div>
              <div className="text-xs text-slate-400 mt-1">Simulation & Community</div>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4">
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono">
                61-D / 50Hz
              </div>
              <div className="text-xs text-slate-400 mt-1">Unified Obs Contract</div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Catalog Section */}
      <section id="catalog" className="py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold text-white tracking-tight">
                Policy Catalog
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Filter by verified hardware execution, locomotion mode, or mechanical accessory
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Direct ONNX runtime compatibility</span>
            </div>
          </div>

          <BehaviorCatalog initialBehaviors={behaviors} />
        </div>
      </section>

      {/* Product Philosophy & Rationale */}
      <section className="border-t border-slate-800/80 bg-slate-950/60 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-12">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Why uDuck Registry?
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Designed as a thin, curated index over existing Hugging Face and GitHub repositories rather than a competing model host.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-white">Canonical Artifacts First</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                We don&apos;t copy multi-megabyte ONNX files or checkpoints. We point directly to upstream Hugging Face Spaces and GitHub releases so author attribution and provenance stay intact.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-white">Rigorous Verification</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Physical hardware behaviors are strictly separated from simulation checkpoints. Every entry declares whether it ran on physical Dynamixel XL330 servos with video evidence.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-400/10 text-purple-400 border border-purple-400/20">
                <Cpu className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-white">Drop-in robotd Config</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Every behavior page outputs the exact lines for <code className="text-amber-300 font-mono">/etc/robot/robotd.toml</code> on the robot&apos;s Rockchip RK3566 board. Swap gaits in seconds.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
