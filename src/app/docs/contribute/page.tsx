import Link from "next/link";
import { ArrowLeft, GitFork, CheckCircle2, Terminal, AlertCircle, Copy } from "lucide-react";

export const metadata = {
  title: "Contribute a Behavior — uDuck Registry",
  description: "Guidelines and instructions for submitting new MicroDuck behaviors, policies, and environments to uDuck Registry.",
};

export default function ContributePage() {
  const exampleJson = `{
  "id": "my-cool-trick",
  "name": "My Cool Duck Trick",
  "version": "1.0.0",
  "description": "Short explanation of what your duck does under this policy.",
  "category": "agility-tricks",
  "tags": ["community", "trick", "50hz"],
  "authors": [
    {
      "name": "Your Name",
      "github": "yourgithub"
    }
  ],
  "license": "Apache-2.0",
  "verification": {
    "status": "verified_simulation",
    "summary": "Simulated in mjlab over 4096 environments for 30,000 steps.",
    "hardware_target": "MicroDuck v1 (Dynamixel XL330)",
    "sim_framework": "mjlab (MuJoCo Warp) at 50 Hz"
  },
  "contract": {
    "observation_dim": 61,
    "observation_breakdown": {
      "proprioception": 48,
      "twist": 3,
      "head_pose": 4,
      "body_pose": 6
    },
    "action_dim": 14,
    "action_breakdown": {
      "left_leg": 5,
      "neck_head": 4,
      "right_leg": 5
    },
    "control_frequency_hz": 50,
    "decimation": 4,
    "actuator_model": "Dynamixel XL330 (BAM M6 actuator physics)",
    "action_scale": 1.0
  },
  "compatibility": {
    "robot_model": "microduck-standard",
    "mjcf_model": "robot_allcollisions.xml",
    "accessories_required": [],
    "terrain": ["flat"],
    "robotd_slot": "custom"
  },
  "artifacts": {
    "onnx": {
      "filename": "my_cool_trick.onnx",
      "url": "https://huggingface.co/.../my_cool_trick.onnx",
      "baked_normalizer": true
    }
  },
  "media": {
    "hero_type": "badge",
    "caption": "My duck executing the trick"
  },
  "sources": {
    "upstream_repo": "https://github.com/yourgithub/my_duck_repo"
  },
  "deployment": {
    "robotd_toml": "[policy]\\ncustom_trick = \\"/opt/robot/policies/my_cool_trick.onnx\\""
  }
}`;

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

        {/* Header */}
        <div className="border-b border-slate-800 pb-6 space-y-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-purple-400/10 px-2.5 py-0.5 text-xs font-mono text-purple-400 border border-purple-400/20">
              Contribution Guide
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            How to Submit a Behavior
          </h1>
          <p className="text-sm text-slate-400">
            uDuck Registry is community-maintained. Submitting a behavior requires only adding a single JSON manifest to our GitHub repository.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-8">
          <div className="space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-slate-950 font-bold text-xs">1</span>
              Fork the Repository & Create Your File
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Create a new JSON file under <code className="text-amber-300 font-mono">registry/behaviors/&lt;your-id&gt;.json</code>. The filename must strictly match the <code className="text-white font-mono">&quot;id&quot;</code> field inside the JSON.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-slate-950 font-bold text-xs">2</span>
              Adhere to the 61-D / 14-Actuator Contract
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Verify that your policy was exported using <code className="text-white font-mono">scripts/export.py</code> with a baked observation normalizer, exactly 61 observation inputs, and 14 joint outputs.
            </p>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-2.5 text-xs text-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Verification Semantics:</strong> If you claim <code className="text-white font-mono">&quot;verified_hardware&quot;</code>, please provide video evidence or telemetry logs from an actual MicroDuck in your PR description. Otherwise use <code className="text-white font-mono">&quot;verified_simulation&quot;</code>.
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-slate-950 font-bold text-xs">3</span>
              Run Automated Validation
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Ensure your file passes the test suite before submitting:
            </p>
            <pre className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 font-mono text-xs text-emerald-400">
              <code>pnpm validate{"\n"}pnpm test</code>
            </pre>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-slate-950 font-bold text-xs">4</span>
              Submit a Pull Request
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Open a PR against the main branch. Once merged, GitHub Actions will automatically validate the catalog, recompile <code className="text-amber-300 font-mono">registry.json</code>, and update the live public site.
            </p>
          </div>
        </div>

        {/* Starter Template */}
        <div className="space-y-3 border-t border-slate-800 pt-8">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <GitFork className="h-4 w-4 text-purple-400" />
            Starter JSON Template
          </h2>
          <pre className="max-h-96 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300">
            <code>{exampleJson}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
