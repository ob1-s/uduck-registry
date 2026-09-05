import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPolicies, policyName, policySummary } from '@/lib/policies';

export function generateStaticParams() { return getPolicies().map(p => ({ id: p.id })); }
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = getPolicies().find(p => p.id === id);
  return { title: p ? `${policyName(p)} — uDuck Registry` : 'Policy not found' };
}
export default async function PolicyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = getPolicies().find(p => p.id === id);
  if (!p) notFound();
  const r = p.resolved;
  const m = r.manifest;
  const source = `https://huggingface.co/${p.source.repo}/tree/${p.source.revision}`;
  const target = `${p.source.repo}@${p.source.revision}`;
  const install = r.install_route === 'slot'
    ? `robotctl policy load ${m.slot} ${target}`
    : r.install_route === 'skill' ? `robotctl policy add ${p.id} ${target}` : null;
  return <div className="detail-page"><div className="detail-wrap">
    <Link className="back-link" href="/">← Back to the library</Link>
    <header className="detail-header"><div className="detail-meta">
      <span className="detail-chip">Pollen Hub package</span><span className="detail-chip">{p.curation.category}</span>
      <span className="detail-chip">Hardware: no registry verification</span>
    </div><h1>{policyName(p)}</h1><p className="detail-description">{policySummary(p)}</p>
      <p>Published by <a href={source}>{p.source.repo.split('/')[0]}</a> · License: {r.license ?? 'not declared'}</p>
    </header>
    <div className="detail-stack">
      {p.media?.map(item => <figure className="surface detail-card" key={item.url}>
        {item.type === 'video' ? <video controls preload="metadata" src={item.url} style={{ width: '100%' }} /> : <img src={item.url} alt={item.label} style={{ width: '100%' }} />}
        <figcaption>Author-provided media · {item.label}</figcaption>
      </figure>)}
      <section className="surface detail-card"><h2>Install with Pollen</h2>
        {install ? <><p>Package metadata supports this upstream install route. Review the publisher’s command values before running the move.</p><pre className="code-block"><code>{install}</code></pre></> : <p>This package needs a command, slot, or compatibility review before we can offer an install command.</p>}
        <a href={source}>Open the exact upstream revision ↗</a>
        {r.unresolved.length > 0 && <ul>{r.unresolved.map(reason => <li key={reason}>{reason}</li>)}</ul>}
      </section>
      <section className="surface detail-card"><h2>Registry evidence</h2>
        <dl className="detail-list"><div><dt>ONNX inspection</dt><dd>61 inputs → 14 outputs; finite zero-input smoke check passed</dd></div>
          <div><dt>Behavior simulation</dt><dd>Not covered</dd></div><div><dt>Hardware</dt><dd>No registry verification</dd></div></dl>
        <p>{r.simulation.reason}</p><p>A package inspection does not test the move, its training environment, or physical safety. Upstream eval metadata remains an author claim.</p>
      </section>
      <section className="surface detail-card"><h2>Exact artifact</h2><dl className="detail-list">
        <div><dt>Repository</dt><dd>{p.source.repo}</dd></div><div><dt>Revision</dt><dd className="mono-value">{p.source.revision}</dd></div>
        <div><dt>policy.onnx SHA256</dt><dd className="mono-value" style={{ overflowWrap: 'anywhere' }}>{p.source.artifact_sha256}</dd></div>
        <div><dt>manifest.json SHA256</dt><dd className="mono-value" style={{ overflowWrap: 'anywhere' }}>{p.source.manifest_sha256}</dd></div>
      </dl></section>
      {p.curation.notes && <section className="surface detail-card"><h2>Curator notes</h2><p>{p.curation.notes}</p></section>}
      <details className="surface detail-card"><summary>Upstream manifest · publisher-declared facts</summary><pre className="code-block" style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(m, null, 2)}</pre></details>
    </div>
  </div></div>;
}
