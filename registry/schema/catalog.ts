import { z } from "zod";
import type { Behavior } from "./behavior";
import type { PolicyPointer, ResolvedPolicy } from "./policy";
import { isAllowedArtifactUrl, isAllowedMediaUrl, isHttpsUrl } from "./allowlist";

/**
 * The public catalog is the boundary between authored registry inputs and
 * consumers.  A Hub package and a manually curated record have one shape here;
 * missing upstream facts stay null instead of being filled with a runtime
 * default.
 */

const strict = <T extends z.ZodRawShape>(shape: T) => z.strictObject(shape);
const NullableString = z.string().nullable();
const NullableNumber = z.number().finite().nullable();
const NullableUrl = z.string().url().refine(isHttpsUrl).nullable();
const NullableMediaUrl = z.string().refine(isAllowedMediaUrl).nullable();
const NullableSha256 = z.string().regex(/^[a-f0-9]{64}$/).nullable();
const NullableRevision = z.string().regex(/^[a-f0-9]{40}$/).nullable();

const CatalogAuthorSchema = strict({
  name: z.string().min(1),
  affiliation: z.string().min(1).nullable(),
  github: z.string().min(1).nullable(),
  url: NullableUrl,
});

export const CatalogSourceKindSchema = z.enum(["pollen-hub", "manual"]);
export type CatalogSourceKind = z.infer<typeof CatalogSourceKindSchema>;

const CatalogSourceSchema = strict({
  /** A Hub package was resolved from a Pollen schema-2 repository. */
  kind: CatalogSourceKindSchema,
  repository_url: NullableUrl,
  package_url: NullableUrl,
  revision: NullableRevision,
  manifest_sha256: NullableSha256,
  artifact: strict({
    filename: z.string().min(1).nullable(),
    url: z.string().refine(isAllowedArtifactUrl).nullable(),
    sha256: NullableSha256,
  }).nullable(),
  upstream: strict({
    runtime_url: NullableUrl,
    training_url: NullableUrl,
    simulator_url: NullableUrl,
    task_id: NullableString,
  }),
});
export type CatalogSource = z.infer<typeof CatalogSourceSchema>;

const CatalogContractSchema = strict({
  observation_dim: NullableNumber,
  action_dim: NullableNumber,
  control_frequency_hz: NullableNumber,
  action_scale: NullableNumber,
  decimation: NullableNumber,
  actuator_model: NullableString,
});

const CatalogCompatibilitySchema = strict({
  /** Exact manifest string when available; legacy values are source-labelled. */
  robot_model: NullableString,
  accessories_required: z.array(z.string().min(1)).nullable(),
  terrain: z.array(z.string().min(1)).nullable(),
});

const CatalogInstallSchema = strict({
  route: z.enum(["skill", "slot", "review", "manual"]).nullable(),
  command: NullableString,
  config: NullableString,
});

const CatalogRuntimeSchema = strict({
  /** Classification is derived from package resolution, never editorial. */
  classification: z.enum(["pollen-hub", "pollen-review", "custom"]),
  kind: z.enum(["episodic", "perpetual", "scripted"]).nullable(),
  slot: NullableString,
  duration_s: NullableNumber,
  unwind_s: NullableNumber,
  command_encoding: z.enum(["constant", "phase", "posture_flag", "absent"]).nullable(),
  robot: strict({
    model: NullableString,
    hw_rev: NullableNumber,
    servos: NullableString,
  }),
  contract: CatalogContractSchema,
  compatibility: CatalogCompatibilitySchema,
  install: CatalogInstallSchema,
  unresolved: z.array(z.string().min(1)),
});
export type CatalogRuntime = z.infer<typeof CatalogRuntimeSchema>;

export const CoverageStatusSchema = z.enum(["passed", "failed", "not-run", "not-covered"]);
export type CoverageStatus = z.infer<typeof CoverageStatusSchema>;

const CatalogCheckSchema = strict({
  check: z.string().min(1),
  passed: z.boolean(),
  detail: z.string().min(1),
});

const CatalogPackageInspectionSchema = strict({
  status: CoverageStatusSchema,
  input_shape: z.array(z.unknown()).nullable(),
  output_shape: z.array(z.unknown()).nullable(),
  scope: NullableString,
});

const CatalogSimulationSchema = strict({
  status: CoverageStatusSchema,
  evidence_key: NullableSha256,
  inputs_sha256: NullableSha256,
  runner: NullableString,
  scene: NullableString,
  scenario: NullableString,
  report_url: NullableMediaUrl,
  loop_url: NullableMediaUrl,
  poster_url: NullableMediaUrl,
  checks: z.array(CatalogCheckSchema),
  reason: NullableString,
});

const CatalogCoverageSchema = strict({
  package_inspection: CatalogPackageInspectionSchema,
  registry_simulation: CatalogSimulationSchema,
});
export type CatalogCoverage = z.infer<typeof CatalogCoverageSchema>;

const CatalogHardwareSchema = strict({
  /** Hardware proof is never inferred from upstream identity or media. */
  status: z.enum(["none", "author-claimed", "maintainer-verified"]),
  target: NullableString,
  note: NullableString,
});
export type CatalogHardware = z.infer<typeof CatalogHardwareSchema>;

const CatalogMediaItemSchema = strict({
  type: z.enum(["image", "video"]),
  url: z.string().refine(isAllowedMediaUrl),
  label: z.string().min(1),
});

const CatalogMediaSchema = strict({
  author: z.array(CatalogMediaItemSchema),
  registry: strict({
    loop_url: z.string().refine(isAllowedMediaUrl),
    poster_url: z.string().refine(isAllowedMediaUrl),
    report_url: z.string().refine(isAllowedMediaUrl),
  }).nullable(),
  primary: z.enum(["author", "registry", "none"]),
});
export type CatalogMedia = z.infer<typeof CatalogMediaSchema>;

export const CatalogEntrySchema = strict({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1),
  version: z.string().nullable(),
  description: z.string().min(1),
  details: z.string().nullable(),
  category: z.string().min(1),
  tags: z.array(z.string().min(1)),
  authors: z.array(CatalogAuthorSchema).min(1),
  license: NullableString,
  curation: strict({
    summary: NullableString,
    notes: NullableString,
  }),
  source: CatalogSourceSchema,
  runtime: CatalogRuntimeSchema,
  coverage: CatalogCoverageSchema,
  hardware: CatalogHardwareSchema,
  media: CatalogMediaSchema,
});
export type CatalogEntry = z.infer<typeof CatalogEntrySchema>;

export interface RegistryIndex {
  version: "3.0.0";
  updated_at: string;
  count: number;
  entries: CatalogEntry[];
}

/** Evidence is intentionally structural: both local build artifacts and a
 * future release-backed reader can provide these fields without changing the
 * public catalog contract. */
export interface CatalogSimulationEvidence {
  status?: CoverageStatus;
  evidence_key?: string | null;
  inputs_sha256?: string | null;
  runner?: string | null;
  scene?: string | null;
  scenario?: string | null;
  report_url?: string | null;
  loop_url?: string | null;
  poster_url?: string | null;
  checks?: Array<{ check: string; passed: boolean; detail: string }>;
  reason?: string | null;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nullableSha(value: unknown): string | null {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value) ? value : null;
}

function nullableRevision(value: unknown): string | null {
  return typeof value === "string" && /^[a-f0-9]{40}$/.test(value) ? value : null;
}

function httpsOrNull(value: unknown): string | null {
  return typeof value === "string" && isHttpsUrl(value) ? value : null;
}

function mediaOrNull(value: unknown): string | null {
  return typeof value === "string" && isAllowedMediaUrl(value) ? value : null;
}

function allowedArtifactOrNull(value: unknown): string | null {
  return typeof value === "string" && isAllowedArtifactUrl(value) ? value : null;
}

function recordValue(value: unknown, key: string): unknown {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    return null;
  }
  return value;
}

function authorFromBehavior(behavior: Behavior): CatalogEntry["authors"] {
  return behavior.authors.map((author) => ({
    name: author.name,
    affiliation: author.affiliation ?? null,
    github: author.github ?? null,
    url: author.url ?? null,
  }));
}

function normalizeLicense(value: unknown): string | null {
  const license = nullableString(value);
  if (!license || /^(not provided|not separately specified|unknown)$/i.test(license)) return null;
  return license;
}

function authorMediaFromBehavior(behavior: Behavior): CatalogMedia["author"] {
  const items: CatalogMedia["author"] = [];
  if (behavior.media.thumbnail_url) items.push({ type: "image", url: behavior.media.thumbnail_url, label: "Author-provided thumbnail" });
  if (behavior.media.loop_url) items.push({ type: "video", url: behavior.media.loop_url, label: "Author-provided loop" });
  if (behavior.media.video_url && behavior.media.video_url !== behavior.media.loop_url) items.push({ type: "video", url: behavior.media.video_url, label: "Author-provided video" });
  return items;
}

function authorMediaFromPolicy(policy: PolicyPointer): CatalogMedia["author"] {
  return (policy.media ?? []).map((item) => ({ type: item.type, url: item.url, label: item.label }));
}

function registryMedia(evidence?: CatalogSimulationEvidence | null): CatalogMedia["registry"] {
  if (!evidence?.loop_url || !evidence.poster_url || !evidence.report_url) return null;
  const loop = mediaOrNull(evidence.loop_url);
  const poster = mediaOrNull(evidence.poster_url);
  const report = mediaOrNull(evidence.report_url);
  if (!loop || !poster || !report) return null;
  return { loop_url: loop, poster_url: poster, report_url: report };
}

function coverageReportUrl(evidence?: CatalogSimulationEvidence | null): string | null {
  // Coverage report availability is independent from registry media: an
  // unsupported/rejected/failed-before-render report legitimately has a
  // report with no loop/poster. Do not hide it behind the media gate.
  return mediaOrNull(evidence?.report_url);
}

function coverage(
  packageInspection: CatalogCoverage["package_inspection"],
  evidence?: CatalogSimulationEvidence | null,
): CatalogCoverage {
  const media = registryMedia(evidence);
  // Fail closed: only explicit passed/failed/not-covered/not-run become
  // evidence. Missing status never infers "passed".
  const rawStatus = evidence?.status;
  const status: CatalogCoverage["registry_simulation"]["status"] =
    rawStatus === "passed" || rawStatus === "failed" || rawStatus === "not-covered" || rawStatus === "not-run"
      ? rawStatus
      : media
        ? "failed"
        : "not-run";
  // Malformed rendered evidence (missing key/inputs/checks) must not become
  // positive evidence. Require the identity fields for a passed claim.
  let finalStatus = status;
  if (finalStatus === "passed") {
    const hasIdentity = nullableSha(evidence?.evidence_key) && nullableSha(evidence?.inputs_sha256);
    const hasChecks = Array.isArray(evidence?.checks) && (evidence?.checks?.length ?? 0) > 0;
    if (!hasIdentity || !hasChecks) finalStatus = "failed";
  }
  return {
    package_inspection: packageInspection,
    registry_simulation: {
      status: finalStatus,
      evidence_key: nullableSha(evidence?.evidence_key),
      inputs_sha256: nullableSha(evidence?.inputs_sha256),
      runner: nullableString(evidence?.runner),
      scene: nullableString(evidence?.scene),
      scenario: nullableString(evidence?.scenario),
      report_url: coverageReportUrl(evidence),
      loop_url: media?.loop_url ?? null,
      poster_url: media?.poster_url ?? null,
      checks: Array.isArray(evidence?.checks) ? (evidence?.checks as CatalogCoverage["registry_simulation"]["checks"]) : [],
      reason: nullableString(evidence?.reason),
    },
  };
}

function behaviorSimulationEvidence(behavior: Behavior): CatalogSimulationEvidence | null {
  // The report reader is deliberately optional.  CI/build code may attach a
  // release-backed report later; a descriptor alone never counts as evidence.
  return null;
}

function sourceForBehavior(behavior: Behavior): CatalogSource {
  const artifactUrl = allowedArtifactOrNull(behavior.artifacts.onnx.url);
  return {
    kind: "manual",
    repository_url: httpsOrNull(behavior.sources.upstream_repo),
    package_url: null,
    revision: null,
    manifest_sha256: null,
    artifact: {
      filename: nullableString(behavior.artifacts.onnx.filename),
      url: artifactUrl,
      sha256: null,
    },
    upstream: {
      runtime_url: httpsOrNull(behavior.sources.upstream_repo),
      training_url: httpsOrNull(behavior.sources.training_code_url),
      simulator_url: httpsOrNull(behavior.sources.huggingface_space),
      task_id: nullableString(behavior.sources.task_id),
    },
  };
}

function runtimeForBehavior(behavior: Behavior): CatalogRuntime {
  const simulation = behavior.simulation;
  const simulationReason = simulation?.runner === "external"
    ? simulation.notes ?? simulation.reason
    : simulation
      ? "A registry recipe exists; its build evidence is reported separately."
      : "No registry simulation recipe is authored for this manual entry.";
  return {
    classification: "custom",
    kind: null,
    slot: behavior.compatibility.robotd_slot,
    duration_s: simulation?.runner === "microduck-standard-v1" ? simulation.duration_s : null,
    unwind_s: null,
    command_encoding: null,
    robot: {
      model: behavior.compatibility.robot_model,
      hw_rev: null,
      servos: null,
    },
    contract: {
      observation_dim: behavior.contract.observation_dim,
      action_dim: behavior.contract.action_dim,
      control_frequency_hz: behavior.contract.control_frequency_hz,
      action_scale: behavior.contract.action_scale,
      decimation: behavior.contract.decimation,
      actuator_model: behavior.contract.actuator_model,
    },
    compatibility: {
      robot_model: behavior.compatibility.robot_model,
      accessories_required: [...behavior.compatibility.accessories_required],
      terrain: [...behavior.compatibility.terrain],
    },
    install: {
      route: "manual",
      command: null,
      config: behavior.deployment.robotd_toml,
    },
    unresolved: [simulationReason],
  };
}

/** Convert an existing manually authored descriptor at the public boundary. */
export function catalogEntryFromBehavior(
  behavior: Behavior,
  evidence?: CatalogSimulationEvidence | null,
): CatalogEntry {
  const authorMedia = authorMediaFromBehavior(behavior);
  const registry = registryMedia(evidence);
  // Hardware migration: never strengthen a claim. claimed_hardware with an
  // attributable upstream publisher source becomes author-claimed (not
  // uDuck-verified). verified_hardware without independent registry evidence
  // is downgraded. community_experimental carries no hardware claim.
  // Audited 2026-09-05: 9 claimed_hardware entries all cite
  // pollen-robotics/microduck as upstream with explicit "Verified on physical
  // Microduck hardware" summaries and, in most cases, upstream hardware clips.
  // They are preserved as publisher claims, never as maintainer-verified.
  let hardwareStatus: "none" | "author-claimed" | "maintainer-verified" = "none";
  let hardwareNote: string | null;
  if (behavior.verification.status === "claimed_hardware") {
    hardwareStatus = "author-claimed";
    hardwareNote =
      `Publisher claim from ${behavior.sources.upstream_repo}: ${behavior.verification.summary} ` +
      `Not independently verified by uDuck.`;
  } else if (behavior.verification.status === "verified_hardware") {
    hardwareStatus = "none";
    hardwareNote =
      `Descriptor claims independent verification, but no attributable registry evidence is recorded; ` +
      `downgraded to none pending maintainer review. Original summary: ${behavior.verification.summary}`;
  } else {
    hardwareNote = "No independently attributable registry hardware evidence is recorded.";
  }
  return CatalogEntrySchema.parse({
    id: behavior.id,
    name: behavior.name,
    version: behavior.version,
    description: behavior.description,
    details: behavior.details ?? null,
    category: behavior.category,
    tags: [...behavior.tags],
    authors: authorFromBehavior(behavior),
    license: normalizeLicense(behavior.license),
    curation: {
      summary: null,
      notes: null,
    },
    source: sourceForBehavior(behavior),
    runtime: runtimeForBehavior(behavior),
    coverage: coverage({
      status: "not-run",
      input_shape: null,
      output_shape: null,
      scope: null,
    }, evidence ?? behaviorSimulationEvidence(behavior)),
    hardware: {
      status: hardwareStatus,
      target: nullableString(behavior.verification.hardware_target),
      note: hardwareNote,
    },
    media: {
      author: authorMedia,
      registry,
      primary: registry ? "registry" : authorMedia.length > 0 ? "author" : "none",
    },
  });
}

function manifestObject(policy: ResolvedPolicy): Record<string, unknown> {
  return policy.resolved.manifest;
}

function manifestString(manifest: Record<string, unknown>, key: string): string | null {
  return nullableString(manifest[key]);
}

function manifestNumber(manifest: Record<string, unknown>, key: string): number | null {
  return nullableNumber(manifest[key]);
}

function manifestRobot(manifest: Record<string, unknown>): Record<string, unknown> {
  const robot = manifest.robot;
  return robot && typeof robot === "object" && !Array.isArray(robot)
    ? robot as Record<string, unknown>
    : {};
}

function manifestTraining(manifest: Record<string, unknown>): Record<string, unknown> {
  const training = manifest.training;
  return training && typeof training === "object" && !Array.isArray(training)
    ? (training as Record<string, unknown>)
    : {};
}

function trainingRepoUrl(training: Record<string, unknown>): string | null {
  const repo = training.repo;
  if (typeof repo !== "string") return null;
  // Only link a clean owner/repo slug; never parse prose into a fake URL.
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(repo)) return null;
  if (repo.startsWith("datasets/") || repo.startsWith("spaces/") || repo.startsWith("models/")) return null;
  const url = `https://github.com/${repo}`;
  return httpsOrNull(url);
}

function manifestCommandEncoding(manifest: Record<string, unknown>): CatalogRuntime["command_encoding"] {
  const command = manifest.command;
  const encoding = recordValue(command, "encoding");
  if (encoding === "constant" || encoding === "phase" || encoding === "posture_flag") return encoding;
  return encoding == null ? "absent" : null;
}

function packageInspection(policy: ResolvedPolicy): CatalogCoverage["package_inspection"] {
  const onnx = policy.resolved.onnx;
  const input = Array.isArray(onnx.input) ? onnx.input : null;
  const output = Array.isArray(onnx.output) ? onnx.output : null;
  const smoke = onnx.smoke === "passed";
  return {
    status: input && output && smoke ? "passed" : "failed",
    input_shape: input,
    output_shape: output,
    scope: nullableString(onnx.scope),
  };
}

/** Convert a resolved schema-2 package into the same public record shape. */
export function catalogEntryFromPolicy(
  policy: ResolvedPolicy,
  evidence?: CatalogSimulationEvidence | null,
): CatalogEntry {
  const manifest = manifestObject(policy);
  const robot = manifestRobot(manifest);
  const repo = policy.source.repo;
  const revision = nullableRevision(policy.source.revision);
  const packageUrl = revision ? `https://huggingface.co/${repo}/tree/${revision}` : null;
  const artifactUrl = revision ? `https://huggingface.co/${repo}/resolve/${revision}/policy.onnx` : null;
  const owner = repo.split("/", 1)[0] ?? repo;
  const author = manifestString(manifest, "author") ?? owner;
  const manifestDescription = manifestString(manifest, "description");
  const summary = policy.curation.summary ?? manifestDescription;
  const unresolved = [...policy.resolved.unresolved];
  const route = policy.resolved.install_route;
  const slot = manifestString(manifest, "slot");
  const installTarget = `${repo}@${revision ?? ""}`.replace(/@$/, "");
  const command = route === "skill"
    ? `robotctl policy add ${policy.id} ${installTarget}`
    : route === "slot" && slot
      ? `robotctl policy load ${slot} ${installTarget}`
      : null;
  const authorMedia = authorMediaFromPolicy(policy);
  const registry = registryMedia(evidence);
  const contractObservation = manifestNumber(manifest, "obs_len");
  const contractAction = manifestNumber(manifest, "action_len");
  const robotControlHz = nullableNumber(robot.control_hz);
  const robotModel = nullableString(robot.model);
  const training = manifestTraining(manifest);
  const trainingUrl =
    httpsOrNull(manifestString(manifest, "training_code_url")) ?? trainingRepoUrl(training);
  const taskId =
    manifestString(manifest, "task_id") ??
    manifestString(manifest, "task") ??
    nullableString(training.task_id);
  return CatalogEntrySchema.parse({
    id: policy.id,
    name: manifestString(manifest, "name") ?? policy.id,
    version: manifestString(manifest, "version"),
    description: summary ?? "Microduck policy published on Hugging Face.",
    details: null,
    category: policy.curation.category,
    tags: [...policy.curation.tags],
    authors: [{ name: author, affiliation: null, github: null, url: null }],
    license: normalizeLicense(policy.resolved.license),
    curation: {
      summary: policy.curation.summary ?? null,
      notes: policy.curation.notes ?? null,
    },
    source: {
      kind: "pollen-hub",
      repository_url: `https://huggingface.co/${repo}`,
      package_url: packageUrl,
      revision,
      manifest_sha256: nullableSha(policy.source.manifest_sha256),
      artifact: {
        filename: "policy.onnx",
        url: artifactUrl,
        sha256: nullableSha(policy.source.artifact_sha256),
      },
      upstream: {
        runtime_url: null,
        training_url: trainingUrl,
        simulator_url: null,
        task_id: taskId,
      },
    },
    runtime: {
      classification: policy.resolved.runtime,
      kind: manifest.kind === "episodic" || manifest.kind === "perpetual" || manifest.kind === "scripted" ? manifest.kind : null,
      slot,
      duration_s: manifestNumber(manifest, "duration_s"),
      unwind_s: manifestNumber(manifest, "unwind_s"),
      command_encoding: manifestCommandEncoding(manifest),
      robot: {
        model: robotModel,
        hw_rev: nullableNumber(robot.hw_rev),
        servos: nullableString(robot.servos),
      },
      contract: {
        observation_dim: contractObservation,
        action_dim: contractAction,
        control_frequency_hz: robotControlHz,
        action_scale: manifestNumber(manifest, "action_scale"),
        decimation: null,
        actuator_model: null,
      },
      compatibility: {
        robot_model: robotModel,
        accessories_required: null,
        terrain: null,
      },
      install: {
        route,
        command,
        config: null,
      },
      unresolved,
    },
    coverage: coverage(packageInspection(policy), evidence),
    hardware: {
      status: "none",
      target: robotModel,
      note: "No registry hardware verification; upstream manifest and eval metadata are publisher facts.",
    },
    media: {
      author: authorMedia,
      registry,
      primary: registry ? "registry" : authorMedia.length > 0 ? "author" : "none",
    },
  });
}

export function catalogEntriesFromSources(
  behaviors: Behavior[],
  policies: ResolvedPolicy[],
  evidenceById: ReadonlyMap<string, CatalogSimulationEvidence> = new Map(),
): CatalogEntry[] {
  const entries = [
    ...behaviors.map((behavior) => catalogEntryFromBehavior(behavior, evidenceById.get(behavior.id))),
    ...policies.map((policy) => catalogEntryFromPolicy(policy, evidenceById.get(policy.id))),
  ];
  return entries.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

