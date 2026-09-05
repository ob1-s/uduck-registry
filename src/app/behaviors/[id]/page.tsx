import PolicyPage from "../../policies/[id]/page";
import { getPolicies, policyName, policySummary } from "@/lib/policies";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowUpRight, Box, CheckCircle2, ChevronDown, Download, ExternalLink, GitFork, Layers, ShieldCheck, Terminal } from "lucide-react";
import { getAllBehaviors, getBehaviorById } from "@/lib/registry";
import { formatAccessory, formatCategory } from "@/lib/labels";
import { VerificationBadge } from "@/components/VerificationBadge";
import { ContractSpec } from "@/components/ContractSpec";
import { MediaPreview } from "@/components/MediaPreview";
import { getSocialCopy, getSocialImagePath } from "@/lib/social";
import { SITE_NAME } from "@/lib/site";
import { RegistrySimulation } from "@/components/RegistrySimulation";
import { getRegistrySimulationResult } from "@/lib/simulation-results";
import { hasPublisherMedia, preferredMedia } from "@/lib/simulation";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  return [...getAllBehaviors(), ...getPolicies()].map((behavior) => ({ id: behavior.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const behavior = getBehaviorById(id);
  if (!behavior) {
    const policy = getPolicies().find(p => p.id === id);
    return policy ? { title: `${policyName(policy)} — uDuck Registry`, description: policySummary(policy), alternates: { canonical: `/policies/${id}` } } : { title: "Behavior not found — uDuck Registry" };
  }

  const canonicalPath = `/behaviors/${behavior.id}`;
  const socialCopy = getSocialCopy(behavior);
  const imageAlt = `${behavior.name} behavior performed by Microduck`;

  return {
    title: `${behavior.name} — uDuck Registry`,
    description: behavior.description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      url: canonicalPath,
      title: socialCopy.title,
      description: socialCopy.description,
      images: [{ url: getSocialImagePath(behavior.id, "openGraph"), width: 1200, height: 630, alt: imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: socialCopy.title,
      description: socialCopy.description,
      images: [{ url: getSocialImagePath(behavior.id, "twitter"), width: 1200, height: 630, alt: imageAlt }],
    },
  };
}

export default async function BehaviorDetailPage({ params }: Props) {
  const { id } = await params;
  const behavior = getBehaviorById(id);
  if (!behavior) {
    if (getPolicies().some(p => p.id === id)) return <PolicyPage params={params} />;
    notFound();
  }

  const author = behavior.authors[0];
  const authorUrl = author?.url ?? (author?.github ? `https://github.com/${author.github}` : undefined);
  const artifact = behavior.artifacts.onnx;
  const registrySimulation = getRegistrySimulationResult(behavior);
  const publisherHasMedia = hasPublisherMedia(behavior);
  const heroMedia = preferredMedia(behavior, registrySimulation ?? undefined);
  const hasHardwareEvidence = behavior.verification.status !== "community_experimental";
  const downloadCommand = `curl --fail --location --output "${artifact.filename}" "${artifact.url}"`;

  return (
    <div className="detail-page">
      <div className="detail-wrap">
        <Link href="/" className="back-link"><ArrowLeft size={14} aria-hidden="true" /> Back to behaviors</Link>

        <header className="detail-header">
          <div className="detail-meta">
            <VerificationBadge status={behavior.verification.status} summary={behavior.verification.summary} />
            <span className="detail-chip">{formatCategory(behavior.category)}</span>
            <span className="detail-chip">Legacy / manually reviewed entry</span>
            <span className="detail-chip">{behavior.license}</span>
          </div>
          <h1>{behavior.name}</h1>
          <p className="detail-description">{behavior.description}</p>
          <div className="author-strip">
            <span>By <strong>{behavior.authors.map((item) => item.name).join(", ")}</strong></span>
            {authorUrl && (
              <a href={authorUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${author.name}'s profile in a new tab`}>
                <GitFork size={13} aria-hidden="true" /> {author.github ? `@${author.github}` : author.name} <ArrowUpRight size={12} aria-hidden="true" />
              </a>
            )}
          </div>
        </header>

        <figure className="detail-media-figure">
          <div className={`media-frame${!publisherHasMedia && registrySimulation ? " registry-simulation-frame" : ""}`}>
            <MediaPreview media={heroMedia} title={behavior.name} variant="detail" />
          </div>
          {publisherHasMedia && <figcaption className="media-caption">Author-provided media{heroMedia.caption ? ` · ${heroMedia.caption}` : ""}</figcaption>}
        </figure>

        <div className="detail-stack">
          {registrySimulation && (
            <RegistrySimulation
              result={registrySimulation}
              title={behavior.name}
              hasPublisherMedia={publisherHasMedia}
            />
          )}
          {!registrySimulation && <section className="surface detail-card"><h2>Registry simulation</h2><p>{behavior.simulation?.runner === 'external' ? `Not covered: ${behavior.simulation.notes ?? behavior.simulation.reason}.` : 'No current diagnostic evidence is available for this entry.'}</p></section>}
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
                {behavior.verification.notes && <div><dt>Note</dt><dd>{behavior.verification.notes}</dd></div>}
              </dl>
            </section>

            <section className="surface detail-card">
              <h2><Box size={17} aria-hidden="true" /> Compatibility</h2>
              <dl className="detail-list">
                <div><dt>Robot model</dt><dd className="mono-value">{behavior.compatibility.robot_model}</dd></div>
                <div><dt>Terrain</dt><dd><span className="tag-row">{behavior.compatibility.terrain.map((terrain) => <span className="tag" key={terrain}>{terrain}</span>)}</span></dd></div>
                <div><dt>Required accessories</dt><dd>{behavior.compatibility.accessories_required.length > 0 ? <span className="tag-row">{behavior.compatibility.accessories_required.map((item) => <span className="tag tag-sun" key={item}>{formatAccessory(item)}</span>)}</span> : "None — standard duck setup"}</dd></div>
              </dl>
            </section>
          </div>

          <section className="surface deployment-card">
            <div className="deployment-head">
              <div>
                <h2><Terminal size={17} aria-hidden="true" /> Artifact and configuration</h2>
                <p>Download the canonical model and review the policy slot before using it.</p>
              </div>
              <span className="detail-chip">slot: {behavior.compatibility.robotd_slot}</span>
            </div>
            <div className="callout"><AlertTriangle size={15} aria-hidden="true" /><span>{hasHardwareEvidence ? "Hardware testing assumes a matching Microduck, clear space, and a safe surface." : "No physical deployment evidence is listed for this entry. Review the source and compatibility before running it."} uDuck does not guarantee that a policy is safe to run.</span></div>
            <details className="deployment-disclosure">
              <summary className="deployment-summary">
                <span>Configuration steps</span>
                <span className="deployment-summary-action"><span>Show instructions</span><ChevronDown size={14} aria-hidden="true" /></span>
              </summary>
              <div className="deployment-steps">
              <div className="deployment-step">
                <div className="deployment-step-label">
                  <span><b className="deployment-step-number">1</b> Download the policy artifact</span>
                  <a className="download-link" href={behavior.artifacts.onnx.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${behavior.artifacts.onnx.filename} in a new tab`}><Download size={13} aria-hidden="true" /> {behavior.artifacts.onnx.filename}</a>
                </div>
                <pre className="code-block deployment-code"><code>{downloadCommand}</code></pre>
              </div>
              <div className="deployment-step">
                <div className="deployment-step-label"><span><b className="deployment-step-number">2</b> Review the descriptor’s robotd config</span><span className="detail-chip">slot: {behavior.compatibility.robotd_slot}</span></div>
                <pre className="code-block deployment-code"><code>{behavior.deployment.robotd_toml}</code></pre>
              </div>
              <div className="deployment-step">
                <div className="deployment-step-label"><span><b className="deployment-step-number">3</b> Restart the control loop</span></div>
                <pre className="code-block deployment-code"><code>{"sudo systemctl restart robotd"}</code></pre>
              </div>
              </div>
            </details>
          </section>

          <section className="surface detail-card">
            <h2><CheckCircle2 size={17} aria-hidden="true" /> Sources</h2>
            <div className="provenance-grid">
              <a className="provenance-link" href={behavior.sources.upstream_repo} target="_blank" rel="noopener noreferrer" aria-label="Open upstream repository in a new tab">
                <span><small>Upstream repository</small>{behavior.sources.upstream_repo.replace("https://github.com/", "")}</span><ExternalLink size={14} aria-hidden="true" />
              </a>
              {behavior.sources.training_code_url && <a className="provenance-link" href={behavior.sources.training_code_url} target="_blank" rel="noopener noreferrer" aria-label="Open training code in a new tab"><span><small>Training code</small>{behavior.sources.task_id || "Open source"}</span><ExternalLink size={14} aria-hidden="true" /></a>}
              {behavior.sources.huggingface_space && <a className="provenance-link" href={behavior.sources.huggingface_space} target="_blank" rel="noopener noreferrer" aria-label="Open interactive simulator in a new tab"><span><small>Interactive simulator</small>{behavior.sources.huggingface_space}</span><ExternalLink size={14} aria-hidden="true" /></a>}
              {behavior.sources.discussion_url && <a className="provenance-link" href={behavior.sources.discussion_url} target="_blank" rel="noopener noreferrer" aria-label="Open community discussion in a new tab"><span><small>Discussion</small>Community thread</span><ExternalLink size={14} aria-hidden="true" /></a>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
