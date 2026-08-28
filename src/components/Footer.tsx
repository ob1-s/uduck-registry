import Link from "next/link";
import { ExternalLink, Heart, AlertTriangle } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-slate-800/80 bg-slate-950 text-slate-400 text-sm">
      {/* Attribution & Disclaimer Banner */}
      <div className="border-b border-slate-900 bg-amber-950/20 py-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-200/80 leading-relaxed">
            <strong className="text-amber-300 font-semibold">Community Disclaimer:</strong> uDuck Registry is an independent, community-driven discovery and compatibility layer. MicroDuck, the robot hardware, and default alpha policies are designed by{" "}
            <a
              href="https://pollen-robotics.com/microduck"
              target="_blank"
              rel="noreferrer"
              className="underline text-amber-300 hover:text-amber-200"
            >
              Pollen Robotics
            </a>{" "}
            (a subsidiary of Hugging Face). uDuck Registry is not affiliated with, sponsored by, or endorsed by Pollen Robotics or Hugging Face.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand & Purpose */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-base">
              <span>🦆 uDuck Registry</span>
              <span className="text-xs font-mono font-normal text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                v0.1 Public Alpha
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-md leading-relaxed">
              A thin, useful discovery catalog for MicroDuck behaviors, policies, environments, and ecosystem artifacts. Inspired by shadcn-style registries to make robot learning legible, modular, and composable.
            </p>
            <div className="pt-2 text-xs font-mono text-slate-500">
              Contract: 61-dim observation · 14-actuator output · 50 Hz control loop
            </div>
          </div>

          {/* Upstream Ecosystem */}
          <div>
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">
              Upstream Ecosystem
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href="https://github.com/pollen-robotics/microduck"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 hover:text-slate-200 transition-colors"
                >
                  <span>pollen-robotics/microduck</span>
                  <ExternalLink className="h-3 w-3 text-slate-500" />
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/pollen-robotics/microduck_rl"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 hover:text-slate-200 transition-colors"
                >
                  <span>pollen-robotics/microduck_rl</span>
                  <ExternalLink className="h-3 w-3 text-slate-500" />
                </a>
              </li>
              <li>
                <a
                  href="https://huggingface.co/spaces/pollen-robotics/microduck-simulator"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 hover:text-slate-200 transition-colors"
                >
                  <span>MicroDuck HF Simulator</span>
                  <ExternalLink className="h-3 w-3 text-slate-500" />
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/mujocolab/mjlab"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 hover:text-slate-200 transition-colors"
                >
                  <span>mjlab (MuJoCo Warp)</span>
                  <ExternalLink className="h-3 w-3 text-slate-500" />
                </a>
              </li>
            </ul>
          </div>

          {/* Registry & Docs */}
          <div>
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">
              Registry Resources
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/docs/specification" className="hover:text-slate-200 transition-colors">
                  Observation & Action Contract
                </Link>
              </li>
              <li>
                <Link href="/docs/schema" className="hover:text-slate-200 transition-colors">
                  Behavior JSON Schema
                </Link>
              </li>
              <li>
                <Link href="/docs/contribute" className="hover:text-slate-200 transition-colors">
                  How to Submit a Behavior
                </Link>
              </li>
              <li>
                <Link href="/registry.json" target="_blank" className="hover:text-slate-200 transition-colors font-mono">
                  GET /registry.json
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© 2026 uDuck Community. Open source under Apache 2.0.</p>
          <p className="flex items-center gap-1">
            Built with <Heart className="h-3.5 w-3.5 text-amber-500 fill-amber-500" /> for the biped duck robotics community.
          </p>
        </div>
      </div>
    </footer>
  );
}
