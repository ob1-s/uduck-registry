import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import { ArrowLeft, BookOpen, Download, Code2, CheckCircle } from "lucide-react";

export const metadata = {
  title: "Behavior JSON Schema — uDuck Registry",
  description: "Machine-readable schema and field specification for uDuck Registry behavior descriptors.",
};

export default function SchemaPage() {
  const schemaPath = path.resolve(process.cwd(), "registry/schema/behavior.schema.json");
  const schemaContent = fs.existsSync(schemaPath) ? fs.readFileSync(schemaPath, "utf-8") : "{}";

  return (
    <div className="min-h-screen py-10 sm:py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to catalog</span>
        </Link>

        {/* Title */}
        <div className="border-b border-slate-800 pb-6 space-y-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-cyan-400/10 px-2.5 py-0.5 text-xs font-mono text-cyan-400 border border-cyan-400/20">
              JSON Schema Draft 2020-12
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Behavior JSON Schema
          </h1>
          <p className="text-sm text-slate-400">
            Every behavior in uDuck Registry is declared via a self-contained JSON manifest validated against this schema.
          </p>
        </div>

        {/* Schema Field Dictionary */}
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-amber-400" />
            Field Dictionary
          </h2>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-1.5">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="font-bold text-white">id</span>
                <span className="text-cyan-400">string (kebab-case)</span>
              </div>
              <p className="text-xs text-slate-400">Unique identifier matching the manifest filename (e.g. <code className="text-amber-300">alpha-walking.json</code>).</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-1.5">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="font-bold text-white">verification</span>
                <span className="text-cyan-400">object</span>
              </div>
              <p className="text-xs text-slate-400">
                Declares <code className="text-white">status</code> (<code className="text-emerald-400">verified_hardware</code>, <code className="text-cyan-400">verified_simulation</code>, <code className="text-amber-400">claimed_hardware</code>, or <code className="text-purple-400">community_experimental</code>), target hardware, and simulation framework.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-1.5">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="font-bold text-white">contract</span>
                <span className="text-cyan-400">object</span>
              </div>
              <p className="text-xs text-slate-400">
                Observation breakdown (must sum to 61) and action target breakdown (must sum to 14), control frequency (50 Hz), and actuator physics model.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-1.5">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="font-bold text-white">artifacts</span>
                <span className="text-cyan-400">object</span>
              </div>
              <p className="text-xs text-slate-400">
                Pointers to canonical ONNX model file URL (Hugging Face / GitHub), file size, hash, and whether the normalizer is baked into the graph.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-1.5">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="font-bold text-white">deployment</span>
                <span className="text-cyan-400">object</span>
              </div>
              <p className="text-xs text-slate-400">
                Drop-in <code className="text-amber-300">robotd.toml</code> config snippet, duckctl wireless command, and python testing command.
              </p>
            </div>
          </div>
        </div>

        {/* Raw JSON Schema */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Code2 className="h-4 w-4 text-cyan-400" />
              Raw Schema (behavior.schema.json)
            </h2>
          </div>
          <pre className="max-h-96 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300">
            <code>{schemaContent}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
