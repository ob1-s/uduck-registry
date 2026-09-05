import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowUpRight, Box, CheckCircle2, Download, ExternalLink, GitFork, Layers, ShieldCheck, Terminal, XCircle } from "lucide-react";
import { getCatalogEntries, getCatalogEntryById } from "@/lib/registry";
import { coverageLabel, hardwareLabel, primaryMedia, runtimeLabel, runtimeKindLabel } from "@/lib/catalog";
import { formatAccessory, formatCategory } from "@/lib/labels";
import { ContractSpec } from "@/components/ContractSpec";
import { MediaPreview } from "@/components/MediaPreview";
import { SITE_NAME } from "@/lib/site";

interface Props {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return getCatalogEntries().map((entry) => ({ id: entry.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const entry = getCatalogEntryById(id);
  if (!entry) return { title: "Move not found — uDuck Registry" };
  const canonicalPath = `/behaviors/${entry.id}`;
  return {
    title: `${entry.name} — uDuck Registry`,
    description: entry.description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      url: canonicalPath,
      title: entry.name,
      description: entry.description,
      images: [{ url: `/behaviors/${entry.id}/open-graph.png`, width: 1200, height: 630, alt: `${entry.name} performed by Microduck` }],
    },
    twitter: {
      card: "summary_large_image",
      title: entry.name,
      description: entry.description,
      images: [{ url: `/behaviors/${entry.id}/x-card.png`, width: 1200, height: 630, alt: `${entry.name} performed by Microduck` }],
    },
  };
}

function renderNullable(value: string | number | null): string {
  return value == null ? "Unknown" : String(value);
}

function EvidenceBlock({ entry }: { entry: import("@registry/schema/catalog").CatalogEntry }) {
  const inspection = entry.coverage.package_inspection;
  const simulation = entry.coverage.registry_simulation;
  return (
    <section className="surface detail-card">
      <h2><CheckCircle2 size={17} aria-hidden="true" /> Registry evidence</h2>
      <dl className="detail-list">
        <div><dt>Package inspection</dt><dd>{inspection.status}{inspection.input_shape && inspection.output_shape ? ` · ${JSON.stringify(inspection.input_shape)} → ${JSON.stringify(inspection.output_shape)}` : ""}</dd></div>
        <div><dt>Registry simulation</dt><dd>{coverageLabel(simulation.status)}{simulation.runner ? ` · ${simulation.runner}` : ""}</dd></div>
        <div><dt>Hardware</dt><dd>{hardwareLabel(entry.hardware.status)}</dd></div>
      </dl>
      {inspection.scope && <p>{inspection.scope}</p>}
      {simulation.reason && <p>{simulation.reason}</p>}
      {simulation.checks.length > 0 && (
        <div className="registry-checks" aria-label="Registry simulation checks">
          {simulation.checks.map((check) => (
            <div className={`registry-check ${check.passed ? "is-pass" : "is-fail"}`} key={check.check}>
              {check.passed
                ? <CheckCircle2 size={14} aria-hidden="true" />
                : <XCircle size={14} aria-hidden="true" />}
              <span><strong>{check.passed ? "PASS" : "FAIL"} · {check.check.replaceAll("_", " ")}</strong><small>{check.detail}</small></span>
            </div>
          ))}
        </div>
      )}
      {simulation.report_url && <p><a href={simulation.report_url}>Read the complete diagnostic report ↗</a></p>}
      <p className="detail-note">Registry diagnostics describe this pinned artifact in the stated runner. They do not reproduce arbitrary publisher environments or verify physical hardware.</p>
    </section>
  );
}

export default async function BehaviorDetailPage({ params }: Props) {
  const { id } = await params;
  const entry = getCatalogEntryById(id);
  if (!entry) notFound();

  const preview = primaryMedia(entry);
  const author = entry.authors[0];
  const authorUrl = author?.url ?? (author?.github ? `https://github.com/${author.github}` : null);
  const artifact = entry.source.artifact;
  const compatibility = entry.runtime.compatibility;
  const install = entry.runtime.install;
  const sourceUrl = entry.source.repository_url ?? entry.source.package_url;

  return (
    <div className="detail-page">
      <div className="detail-wrap">
        <Link href="/" className="back-link"><ArrowLeft size={14} aria-hidden="true" /> Back to behaviors</Link>

        <header className="detail-header">
          <div className="detail-meta">
            <span className="detail-chip">{runtimeLabel(entry.runtime)}</span>
            <span className="detail-chip">{formatCategory(entry.category)}</span>
            <span className="detail-chip">{hardwareLabel(entry.hardware.status)}</span>
            {entry.license && <span className="detail-chip">{entry.license}</span>}
          </div>
          <h1>{entry.name}</h1>
          <p className="detail-description">{entry.description}</p>
          <div className="author-strip">
            <span>Publisher <strong>{entry.authors.map((item) => item.name).join(", ")}</strong></span>
            {authorUrl && <a href={authorUrl} target="_blank" rel="noopener noreferrer"><GitFork size={13} aria-hidden="true" /> Open publisher profile <ArrowUpRight size={12} aria-hidden="true" /></a>}
          </div>
        </header>

        <figure className="detail-media-figure">
          <div className="media-frame"><MediaPreview media={preview} title={entry.name} variant="detail" /></div>
          {entry.media.primary !== "none" && <figcaption className="media-caption">{entry.media.primary === "registry" ? "Registry-owned diagnostic render" : "Author-provided media"}{preview.caption ? ` · ${preview.caption}` : ""}</figcaption>}
        </figure>

        <div className="detail-stack">
          {entry.details && <section className="surface detail-card"><h2><Layers size={17} aria-hidden="true" /> About this move</h2><p>{entry.details}</p></section>}

          <EvidenceBlock entry={entry} />
          <ContractSpec runtime={entry.runtime} />

          <div className="detail-two-col">
            <section className="surface detail-card">
              <h2><ShieldCheck size={17} aria-hidden="true" /> Hardware</h2>
              <dl className="detail-list">
                <div><dt>Status</dt><dd>{hardwareLabel(entry.hardware.status)}</dd></div>
                <div><dt>Target</dt><dd className="mono-value">{entry.hardware.target ?? "Unknown"}</dd></div>
                {entry.hardware.note && <div><dt>Note</dt><dd>{entry.hardware.note}</dd></div>}
              </dl>
            </section>

            <section className="surface detail-card">
              <h2><Box size={17} aria-hidden="true" /> Compatibility</h2>
              <dl className="detail-list">
                <div><dt>Robot model</dt><dd className="mono-value">{compatibility.robot_model ?? "Unknown"}</dd></div>
                <div><dt>Terrain</dt><dd>{compatibility.terrain == null ? "Unknown" : compatibility.terrain.length > 0 ? <span className="tag-row">{compatibility.terrain.map((terrain) => <span className="tag" key={terrain}>{terrain}</span>)}</span> : "None declared"}</dd></div>
                <div><dt>Required accessories</dt><dd>{compatibility.accessories_required == null ? "Unknown" : compatibility.accessories_required.length > 0 ? <span className="tag-row">{compatibility.accessories_required.map((item) => <span className="tag tag-sun" key={item}>{formatAccessory(item)}</span>)}</span> : "None declared"}</dd></div>
              </dl>
            </section>
          </div>

          <section className="surface deployment-card">
            <div className="deployment-head">
              <div><h2><Terminal size={17} aria-hidden="true" /> Source and installation</h2><p>Installation facts come from the package or the manually reviewed record.</p></div>
              <span className="detail-chip">{runtimeKindLabel(entry.runtime.kind)}</span>
            </div>
            <div className="callout"><AlertTriangle size={15} aria-hidden="true" /><span>{install.route === "manual" ? "This entry has a manual registry configuration; its runtime setup is not independently verified." : install.route === "review" ? "The package needs a command or slot review before an install command can be offered." : "Review the publisher’s runtime and safety instructions before running a policy."}</span></div>
            <dl className="detail-list">
              <div><dt>Install route</dt><dd>{install.route ?? "Unknown"}</dd></div>
              {install.command && <div><dt>Suggested command</dt><dd><pre className="code-block"><code>{install.command}</code></pre></dd></div>}
              {install.config && <div><dt>Manual configuration</dt><dd><pre className="code-block"><code>{install.config}</code></pre></dd></div>}
              {artifact?.url && <div><dt>Artifact</dt><dd><a className="download-link" href={artifact.url} target="_blank" rel="noopener noreferrer"><Download size={13} aria-hidden="true" /> {artifact.filename ?? "policy.onnx"}</a></dd></div>}
              {artifact?.sha256 && <div><dt>Artifact SHA256</dt><dd className="mono-value" style={{ overflowWrap: "anywhere" }}>{artifact.sha256}</dd></div>}
              {entry.source.revision && <div><dt>Source revision</dt><dd className="mono-value">{entry.source.revision}</dd></div>}
              {entry.source.manifest_sha256 && <div><dt>Manifest SHA256</dt><dd className="mono-value" style={{ overflowWrap: "anywhere" }}>{entry.source.manifest_sha256}</dd></div>}
            </dl>
            {entry.runtime.unresolved.length > 0 && <ul>{entry.runtime.unresolved.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
            {entry.source.package_url && <p><a href={entry.source.package_url} target="_blank" rel="noopener noreferrer">Open the exact package revision ↗</a></p>}
          </section>

          {entry.media.author.length > 0 && (
            <section className="surface detail-card">
              <h2><ExternalLink size={17} aria-hidden="true" /> Author showcase</h2>
              <p>Publisher media is presented as a showcase and is separate from registry evidence.</p>
              <div className="provenance-grid">{entry.media.author.map((media) => <a className="provenance-link" href={media.url} target="_blank" rel="noopener noreferrer" key={media.url}><span><small>{media.type === "video" ? "Video" : "Image"}</small>{media.label}</span><ExternalLink size={14} aria-hidden="true" /></a>)}</div>
            </section>
          )}

          <section className="surface detail-card">
            <h2><ExternalLink size={17} aria-hidden="true" /> Sources</h2>
            <div className="provenance-grid">
              {sourceUrl && <a className="provenance-link" href={sourceUrl} target="_blank" rel="noopener noreferrer"><span><small>Repository</small>{sourceUrl.replace(/^https:\/\//, "")}</span><ExternalLink size={14} aria-hidden="true" /></a>}
              {entry.source.upstream.runtime_url && <a className="provenance-link" href={entry.source.upstream.runtime_url} target="_blank" rel="noopener noreferrer"><span><small>Runtime</small>Pollen Microduck</span><ExternalLink size={14} aria-hidden="true" /></a>}
              {entry.source.upstream.training_url && <a className="provenance-link" href={entry.source.upstream.training_url} target="_blank" rel="noopener noreferrer"><span><small>Training source</small>{entry.source.upstream.task_id ?? "Open source"}</span><ExternalLink size={14} aria-hidden="true" /></a>}
              {entry.source.upstream.simulator_url && <a className="provenance-link" href={entry.source.upstream.simulator_url} target="_blank" rel="noopener noreferrer"><span><small>Simulator</small>Publisher simulator</span><ExternalLink size={14} aria-hidden="true" /></a>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

