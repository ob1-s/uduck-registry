import Link from "next/link";
import { Terminal, BookOpen, GitFork, Cpu, ShieldCheck } from "lucide-react";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link href="/" className="group flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/10 border border-amber-400/30 text-2xl transition-transform group-hover:scale-105">
            🦆
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white group-hover:text-amber-400 transition-colors">
                uDuck <span className="text-amber-400 font-mono text-sm font-semibold uppercase tracking-wider">Registry</span>
              </span>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-mono font-medium text-slate-400 border border-slate-700">
                v0.1
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono hidden sm:block">
              community behaviors for MicroDuck
            </p>
          </div>
        </Link>

        {/* Links */}
        <nav className="flex items-center gap-1 sm:gap-4 text-sm font-medium">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Cpu className="h-4 w-4 text-amber-400" />
            <span>Explore</span>
          </Link>

          <Link
            href="/docs/specification"
            className="hidden md:flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Contract Spec</span>
          </Link>

          <Link
            href="/docs/schema"
            className="hidden sm:flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <BookOpen className="h-4 w-4 text-cyan-400" />
            <span>Schema</span>
          </Link>

          <Link
            href="/docs/contribute"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <GitFork className="h-4 w-4 text-purple-400" />
            <span>Contribute</span>
          </Link>

          {/* Machine-readable registry endpoint */}
          <Link
            href="/registry.json"
            target="_blank"
            className="hidden lg:flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs font-mono text-slate-300 hover:border-slate-700 hover:text-amber-300 transition-colors"
            title="Raw machine-readable registry JSON"
          >
            <Terminal className="h-3.5 w-3.5 text-amber-400" />
            <span>/registry.json</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
