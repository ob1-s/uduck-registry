import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowUpRight, Box, CheckCircle2, Download, ExternalLink, GitFork, Layers, ShieldCheck, Terminal } from "lucide-react";
import { getAllBehaviors, getBehaviorById } from "@/lib/registry";
import { VerificationBadge } from "@/components/VerificationBadge";
import { ContractSpec } from "@/components/ContractSpec";

interface Props {
  params: Promise<{ id: string }>;
}

const accessoryLabels: Record<string, string> = {
  roller_skate_blades: "roller skates",
  "70mm_practice_ball": "70 mm ball",
};

export async function generateStaticParams() {
  return getAllBehaviors().map((behavior) => ({ id: behavior.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const behavior = getBehaviorById(id);
  if (!behavior) return { title: "Behavior not found — uDuck Registry" };
  return { title: `${behavior.name} — uDuck Registry`, description: behavior.description };
}

export default async function BehaviorDetailPage({ params }: Props) {
  const { id } = await params;
  const behavior = getBehaviorById(id);
  if (!behavior) notFound();

  const author = behavior.authors[0];
  const formatCategory = behavior.category.replace("-", " ");

  return (
    <div className="detail-page">
      <div className="detail-wrap">
        <Link href="/" className="back-link"><ArrowLeft size={14} aria-hidden="true" /> Back to behaviors</Link>

        <header className="detail-header">
          <div className="detail-meta">
            <VerificationBadge status={behavior.verification.status} summary={behavior.verification.summary} />
            <span className="detail-chip">{formatCategory}</span>
            <span className="detail-chip">v{behavior.version}</span>
            <span className="detail-chip">{behavior.license}</span>
          </div>
          <h1>{behavior.name}</h1>
          <p className="detail-description">{behavior.description}</p>
          <div className="author-strip">
            <span>Built by <strong>{behavior.authors.map((item) => item.name).join(", ")}</strong>{author?.affiliation ? ` · ${author.affiliation}` : ""}</span>
            {author?.github && (
              <a href={`https://github.com/${author.github}`} target="_blank" rel="noreferrer">
                <GitFork size={13} aria-hidden="true" /> @{author.github} <ArrowUpRight size={12} aria-hidden="true" />
              </a>
            )}
          </div>
        </header>

        {behavior.media.video_url && (
          <figure>
            <div className="media-frame">
              <video
                src={behavior.media.video_url}
                controls
                muted
                playsInline
                preload="metadata"
                aria-label={`${behavior.name} demonstration`}
              />
            </div>
            {behavior.media.caption && <figcaption className="media-caption">{behavior.media.caption}</figcaption>}
          </figure>
        )}

        <div className="detail-stack">
          {behavior.details && (
            <section className="surface detail-card">
              <h2><Layers size={17} aria-hidden="true" /> About this behavior</h2>
              <p>{behavior.details}</p>
            </section>
          )}

          <ContractSpec contract={behavior.contract} compatibility={behavior.compatibility} />

          <div className="detail-two-col">
            <section className="surface detail-card">
              <h2><ShieldCheck size={17} aria-hidden="true" /> Verification</h2>
              <dl className="detail-list">
                <div><dt>Status</dt><dd><VerificationBadge status={behavior.verification.status} size="sm" /></dd></div>
                <div><dt>Evidence</dt><dd>{behavior.verification.summary}</dd></div>
                <div><dt>Target hardware</dt><dd className="mono-value">{behavior.verification.hardware_target}</dd></div>
                {behavior.verification.sim_framework && <div><dt>Simulation</dt><dd>{behavior.verification.sim_framework}</dd></div>}
                {behavior.verification.notes && <div><dt>Note</dt><dd>{behavior.verification.notes}</dd></div>}
              </dl>
            </section>

            <section className="surface detail-card">
              <h2><Box size={17} aria-hidden="true" /> Compatibility</h2>
              <dl className="detail-list">
                <div><dt>Robot model</dt><dd className="mono-value">{behavior.compatibility.robot_model}</dd></div>
                <div><dt>MJCF model</dt><dd className="mono-value">{behavior.compatibility.mjcf_model}</dd></div>
                <div><dt>Terrain</dt><dd><span className="tag-row">{behavior.compatibility.terrain.map((terrain) => <span className="tag" key={terrain}>{terrain}</span>)}</span></dd></div>
                <div><dt>Required accessories</dt><dd>{behavior.compatibility.accessories_required.length > 0 ? <span className="tag-row">{behavior.compatibility.accessories_required.map((item) => <span className="tag tag-sun" key={item}>{accessoryLabels[item] || item}</span>)}</span> : "None — standard duck setup"}</dd></div>
              </dl>
            </section>
          </div>

          <section className="surface deployment-card">
            <div className="deployment-head">
              <div>
                <h2><Terminal size={17} aria-hidden="true" /> Run it on your duck</h2>
                <p>Use the canonical model and this policy slot to try the behavior locally.</p>
              </div>
              <span className="detail-chip">slot: {behavior.compatibility.robotd_slot}</span>
            </div>
            <div className="callout"><AlertTriangle size={15} aria-hidden="true" /><span>Try the simulation first. Hardware testing assumes a matching Microduck, clear space, and a safe surface. uDuck does not guarantee that a community policy is safe to run.</span></div>
            <div className="deployment-steps">
              <div className="deployment-step">
                <div className="deployment-step-label">
                  <span><b className="deployment-step-number">1</b> Download the ONNX model</span>
                  <a className="download-link" href={behavior.artifacts.onnx.url} target="_blank" rel="noreferrer"><Download size={13} aria-hidden="true" /> {behavior.artifacts.onnx.filename}</a>
                </div>
                <pre className="code-block deployment-code"><code>{`curl -L "${behavior.artifacts.onnx.url}" -o "/opt/robot/policies/${behavior.artifacts.onnx.filename}"`}</code></pre>
              </div>
              <div className="deployment-step">
                <div className="deployment-step-label"><span><b className="deployment-step-number">2</b> Add the policy to robotd</span></div>
                <pre className="code-block deployment-code"><code>{behavior.deployment.robotd_toml}</code></pre>
              </div>
              <div className="deployment-step">
                <div className="deployment-step-label"><span><b className="deployment-step-number">3</b> Restart the control loop</span></div>
                <pre className="code-block deployment-code"><code>{"sudo systemctl restart robotd\nrobotctl health"}</code></pre>
              </div>
              {behavior.deployment.python_infer_command && (
                <div className="deployment-step">
                  <div className="deployment-step-label"><span><b className="deployment-step-number">⌁</b> Try it in simulation</span></div>
                  <pre className="code-block deployment-code"><code>{behavior.deployment.python_infer_command}</code></pre>
                </div>
              )}
            </div>
          </section>

          <section className="surface detail-card">
            <h2><CheckCircle2 size={17} aria-hidden="true" /> Sources</h2>
            <div className="provenance-grid">
              <a className="provenance-link" href={behavior.sources.upstream_repo} target="_blank" rel="noreferrer">
                <span><small>Upstream repository</small>{behavior.sources.upstream_repo.replace("https://github.com/", "")}</span><ExternalLink size={14} aria-hidden="true" />
              </a>
              {behavior.sources.training_code_url && <a className="provenance-link" href={behavior.sources.training_code_url} target="_blank" rel="noreferrer"><span><small>Training code</small>{behavior.sources.task_id || "Open source"}</span><ExternalLink size={14} aria-hidden="true" /></a>}
              {behavior.sources.huggingface_space && <a className="provenance-link" href={behavior.sources.huggingface_space} target="_blank" rel="noreferrer"><span><small>Interactive simulator</small>{behavior.sources.huggingface_space}</span><ExternalLink size={14} aria-hidden="true" /></a>}
              {behavior.sources.discussion_url && <a className="provenance-link" href={behavior.sources.discussion_url} target="_blank" rel="noreferrer"><span><small>Discussion</small>Community thread</span><ExternalLink size={14} aria-hidden="true" /></a>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
