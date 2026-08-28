import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllBehaviors, getBehaviorById } from "@/lib/registry";
import { VerificationBadge } from "@/components/VerificationBadge";
import { ContractSpec } from "@/components/ContractSpec";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  CheckCircle2,
  Terminal,
  Layers,
  Cpu,
  Shield,
  FileCode,
  Box,
} from "lucide-react";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  const behaviors = getAllBehaviors();
  return behaviors.map((b) => ({ id: b.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const behavior = getBehaviorById(id);
  if (!behavior) return { title: "Behavior Not Found" };

  return {
    title: `${behavior.name} — uDuck Registry`,
    description: behavior.description,
  };
}

export default async function BehaviorDetailPage({ params }: Props) {
  const { id } = await params;
  const behavior = getBehaviorById(id);

  if (!behavior) {
    notFound();
  }

  return (
    <div className="min-h-screen py-10 sm:py-14">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to catalog</span>
        </Link>

        {/* Header Block */}
        <div className="space-y-4 border-b border-slate-800 pb-8">
          <div className="flex flex-wrap items-center gap-2.5">
            <VerificationBadge status={behavior.verification.status} />
            <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-mono uppercase tracking-wider text-slate-300 border border-slate-700">
              {behavior.category}
            </span>
            <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-mono text-slate-400 border border-slate-700">
              v{behavior.version}
            </span>
            <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-mono text-slate-400 border border-slate-700">
              {behavior.license}
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            {behavior.name}
          </h1>

          <p className="text-base text-slate-300 leading-relaxed max-w-3xl">
            {behavior.description}
          </p>

          {/* Authors Strip */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Author:</span>
              <span className="font-semibold text-white">
                {behavior.authors.map((a) => a.name).join(", ")}
              </span>
              {behavior.authors[0]?.affiliation && (
                <span className="text-slate-500">({behavior.authors[0].affiliation})</span>
              )}
            </div>

            {behavior.authors[0]?.github && (
              <a
                href={`https://github.com/${behavior.authors[0].github}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
              >
                <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                <span>@{behavior.authors[0].github}</span>
              </a>
            )}
          </div>
        </div>

        {/* Media Showcase */}
        {behavior.media.video_url && (
          <div className="space-y-2">
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 aspect-video shadow-2xl">
              <video
                src={behavior.media.video_url}
                controls
                autoPlay
                loop
                muted
                playsInline
                className="h-full w-full object-contain"
              />
            </div>
            {behavior.media.caption && (
              <p className="text-center text-xs text-slate-500 font-mono">
                {behavior.media.caption}
              </p>
            )}
          </div>
        )}

        {/* Technical Details */}
        {behavior.details && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-amber-400" />
              Technical Overview & Recipe
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {behavior.details}
            </p>
          </div>
        )}

        {/* Physical Contract Spec */}
        <ContractSpec contract={behavior.contract} compatibility={behavior.compatibility} />

        {/* Verification & Hardware Dossier */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-400" />
              Verification Dossier
            </h3>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-500 block font-mono">Status</span>
                <span className="font-semibold text-slate-200 capitalize">
                  {behavior.verification.status.replace("_", " ")}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block font-mono">Evidence</span>
                <p className="text-slate-300 leading-relaxed">
                  {behavior.verification.summary}
                </p>
              </div>
              <div>
                <span className="text-slate-500 block font-mono">Target Hardware</span>
                <span className="text-slate-300 font-mono">
                  {behavior.verification.hardware_target}
                </span>
              </div>
              {behavior.verification.notes && (
                <div className="rounded-lg bg-slate-950 p-2.5 text-slate-400 font-mono text-[11px] border border-slate-800">
                  Note: {behavior.verification.notes}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Box className="h-4 w-4 text-cyan-400" />
              Hardware Compatibility
            </h3>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-500 block font-mono">Robot Model</span>
                <span className="text-slate-200 font-mono font-medium">
                  {behavior.compatibility.robot_model}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block font-mono">MJCF Simulation Model</span>
                <span className="text-slate-200 font-mono">
                  {behavior.compatibility.mjcf_model}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block font-mono">Supported Terrains</span>
                <div className="flex gap-1.5 mt-1">
                  {behavior.compatibility.terrain.map((t) => (
                    <span
                      key={t}
                      className="rounded bg-slate-800 px-2 py-0.5 text-slate-300 font-mono capitalize"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-slate-500 block font-mono">Required Accessories</span>
                {behavior.compatibility.accessories_required.length > 0 ? (
                  <div className="flex gap-1.5 mt-1">
                    {behavior.compatibility.accessories_required.map((acc) => (
                      <span
                        key={acc}
                        className="rounded bg-amber-400/10 text-amber-300 px-2 py-0.5 font-mono border border-amber-400/20"
                      >
                        {acc}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400">None (standard MicroDuck bare feet)</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Deployment Section */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Terminal className="h-5 w-5 text-amber-400" />
              Deployment & Onboard Setup
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Instructions for running this policy on physical MicroDuck hardware or local simulation
            </p>
          </div>

          <div className="space-y-4">
            {/* Step 1: Download */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-300 font-semibold flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400/20 text-[10px] text-amber-400 font-bold">1</span>
                  Pull Canonical ONNX Model
                </span>
                <a
                  href={behavior.artifacts.onnx.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-mono text-amber-400 hover:text-amber-300"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Direct Download ({behavior.artifacts.onnx.filename})</span>
                </a>
              </div>
              <pre className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 font-mono text-xs text-slate-300 overflow-x-auto">
                <code>{`curl -L "${behavior.artifacts.onnx.url}" -o "/opt/robot/policies/${behavior.artifacts.onnx.filename}"`}</code>
              </pre>
            </div>

            {/* Step 2: Configure robotd.toml */}
            <div className="space-y-2">
              <span className="text-xs font-mono text-slate-300 font-semibold flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400/20 text-[10px] text-amber-400 font-bold">2</span>
                Append to /etc/robot/robotd.toml
              </span>
              <pre className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 font-mono text-xs text-emerald-300 overflow-x-auto">
                <code>{behavior.deployment.robotd_toml}</code>
              </pre>
            </div>

            {/* Step 3: Restart control loop */}
            <div className="space-y-2">
              <span className="text-xs font-mono text-slate-300 font-semibold flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400/20 text-[10px] text-amber-400 font-bold">3</span>
                Restart robotd daemon on robot
              </span>
              <pre className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 font-mono text-xs text-slate-300 overflow-x-auto">
                <code>sudo systemctl restart robotd{"\n"}robotctl health</code>
              </pre>
            </div>

            {/* Simulation playback if available */}
            {behavior.deployment.python_infer_command && (
              <div className="space-y-2 border-t border-slate-800/80 pt-4">
                <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                  Desktop MuJoCo Playback (microduck_rl):
                </span>
                <pre className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 font-mono text-xs text-cyan-300 overflow-x-auto">
                  <code>{behavior.deployment.python_infer_command}</code>
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Provenance & Upstream Links */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white">Provenance & Upstream Links</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <a
              href={behavior.sources.upstream_repo}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-3 hover:border-slate-700 transition-colors"
            >
              <div>
                <span className="text-slate-500 block text-[10px]">Upstream Source Repo</span>
                <span className="text-slate-200">{behavior.sources.upstream_repo.replace("https://github.com/", "")}</span>
              </div>
              <ExternalLink className="h-4 w-4 text-slate-500" />
            </a>

            {behavior.sources.training_code_url && (
              <a
                href={behavior.sources.training_code_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-3 hover:border-slate-700 transition-colors"
              >
                <div>
                  <span className="text-slate-500 block text-[10px]">RL Training Code</span>
                  <span className="text-slate-200">{behavior.sources.task_id || "Training Env"}</span>
                </div>
                <ExternalLink className="h-4 w-4 text-slate-500" />
              </a>
            )}

            {behavior.sources.huggingface_space && (
              <a
                href={behavior.sources.huggingface_space}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-3 hover:border-slate-700 transition-colors sm:col-span-2"
              >
                <div>
                  <span className="text-slate-500 block text-[10px]">Hugging Face Interactive Simulator</span>
                  <span className="text-slate-200">{behavior.sources.huggingface_space}</span>
                </div>
                <ExternalLink className="h-4 w-4 text-slate-500" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
