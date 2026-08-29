import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import { ArrowLeft, BookOpen, Code2 } from "lucide-react";

export const metadata = {
  title: "Manifest schema — uDuck Registry",
  description: "The JSON schema used by uDuck behavior manifests.",
};

const fields = [
  ["id", "string · kebab-case", "The unique slug and matching manifest filename."],
  ["identity", "string · array · object", "Display and provenance: name, version, description, category, tags, authors, license, media, and sources."],
  ["verification", "object", "Status, target hardware, evidence, and optional simulation framework."],
  ["contract", "object", "Observation and action breakdowns, timing, actuator model, and scale."],
  ["compatibility", "object", "Robot model, MJCF model, accessories, terrain, and robotd slot."],
  ["artifacts", "object", "Canonical ONNX URL, filename, hash, size, and normalizer flag."],
  ["deployment", "object", "robotd configuration plus optional CLI and simulation commands."],
];

export default function SchemaPage() {
  const schemaPath = path.resolve(process.cwd(), "registry/schema/behavior.schema.json");
  const schemaContent = fs.existsSync(schemaPath) ? fs.readFileSync(schemaPath, "utf-8") : "{}";

  return (
    <div className="doc-page">
      <div className="doc-wrap">
        <Link href="/" className="back-link"><ArrowLeft size={14} aria-hidden="true" /> Back to behaviors</Link>
        <header className="doc-header">
          <div className="doc-header-meta"><span className="doc-badge">JSON Schema · 2020–12</span><small>For contributors and tools</small></div>
          <h1>A manifest with all the useful bits.</h1>
          <p>Every behavior is one JSON file. The schema keeps names, evidence, hardware details, and launch instructions easy to validate.</p>
        </header>

        <section className="surface doc-section">
          <h2><BookOpen size={17} aria-hidden="true" /> Field guide</h2>
          <p>These top-level fields are required unless marked optional in the schema.</p>
          <div className="doc-grid doc-grid-two">
            {fields.map(([name, type, description]) => <div className="doc-mini-card" key={name}><h3>{name}<span className="doc-field-type">{type}</span></h3><p className="doc-field-description">{description}</p></div>)}
          </div>
        </section>

        <section className="surface doc-section">
          <h2><Code2 size={17} aria-hidden="true" /> behavior.schema.json</h2>
          <p>The live schema used by the registry validator.</p>
          <pre className="code-block"><code>{schemaContent}</code></pre>
        </section>
      </div>
    </div>
  );
}
