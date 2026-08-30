import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import { ArrowLeft, BookOpen, Code2 } from "lucide-react";

export const metadata = {
  title: "Behavior schema — uDuck Registry",
  description: "The JSON schema used by uDuck behavior records.",
};

const fields = [
  ["id", "string · kebab-case", "The unique slug and matching behavior filename."],
  ["name · version · description", "string", "Display name, release version, and a short explanation of the behavior."],
  ["category · tags", "string · array", "The behavior's category and searchable labels."],
  ["authors · license", "array · string", "Who made the behavior and the license for its policy artifact."],
  ["verification", "object", "Status, target hardware, evidence, and notes."],
  ["contract", "object", "Observation and action breakdowns, timing, actuator model, and scale."],
  ["compatibility", "object", "Robot model, accessories, terrain, and robotd slot."],
  ["artifacts", "object", "Canonical ONNX URL, filename, and normalizer flag."],
  ["media", "object", "Optional thumbnail, video, loop, and caption."],
  ["sources", "object", "Upstream repository and optional training or discussion links."],
  ["deployment", "object", "The robotd configuration snippet."],
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
          <h1>A behavior record with all the useful bits.</h1>
          <p>Every behavior is one JSON file. The schema keeps names, provenance, compatibility, and deployment configuration consistent.</p>
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
          <p>The public JSON Schema for behavior records.</p>
          <pre className="code-block"><code>{schemaContent}</code></pre>
        </section>
      </div>
    </div>
  );
}
