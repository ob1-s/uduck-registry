import { z } from "zod";
import type { Policy, ResolvedPolicy } from "./policy";
import { isAllowedArtifactUrl, isAllowedMediaUrl, isHttpsUrl } from "./allowlist";

const strict = <T extends z.ZodRawShape>(shape: T) => z.strictObject(shape);
const NullableString = z.string().nullable();
const NullableNumber = z.number().finite().nullable();
const NullableUrl = z.string().url().refine(isHttpsUrl).nullable();
const NullableMediaUrl = z.string().refine(isAllowedMediaUrl).nullable();
const NullableSha256 = z.string().regex(/^[a-f0-9]{64}$/).nullable();

const CatalogAuthorSchema = strict({
  name: z.string().min(1),
  affiliation: z.string().min(1).nullable(),
  github: z.string().min(1).nullable(),
  url: NullableUrl,
});

/** Source providers are immutable upstream artifacts, never editorial records. */
export const CatalogSourceKindSchema = z.enum(["github", "huggingface-model", "huggingface-space"]);
export type CatalogSourceKind = z.infer<typeof CatalogSourceKindSchema>;

const CatalogSourceSchema = strict({
  kind: CatalogSourceKindSchema,
  repository_url: z.string().url().refine(isHttpsUrl),
  package_url: z.string().url().refine(isHttpsUrl),
  revision: z.string().regex(/^[a-f0-9]{40}$/),
  manifest_sha256: NullableSha256,
  artifact: strict({
    filename: z.string().min(1),
    url: z.string().refine(isAllowedArtifactUrl),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  upstream: strict({
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
  robot_model: NullableString,
  accessories_required: z.array(z.string().min(1)).nullable(),
  terrain: z.array(z.string().min(1)).nullable(),
});

const CatalogInstallSchema = strict({
  route: z.enum(["skill", "slot", "review"]),
  command: NullableString,
  reason: NullableString,
});

const CatalogRuntimeSchema = strict({
  status: z.enum(["ready", "review"]),
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
  status: z.enum(["none", "author-claimed"]),
  target: NullableString,
  source_url: NullableUrl,
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
  version: "4.0.0";
  updated_at: string;
  count: number;
  entries: CatalogEntry[];
}

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

function mediaOrNull(value: unknown): string | null {
  return typeof value === "string" && isAllowedMediaUrl(value) ? value : null;
}

function httpsOrNull(value: unknown): string | null {
  return typeof value === "string" && isHttpsUrl(value) ? value : null;
}

function recordValue(value: unknown, key: string): unknown {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function stringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0)
    ? value
    : null;
}

function normalizeLicense(value: unknown): string | null {
  const license = nullableString(value);
  return license && !/^(not provided|not separately specified|unknown)$/i.test(license) ? license : null;
}

function authorMediaFromPolicy(policy: Policy): CatalogMedia["author"] {
  return (policy.media ?? []).map((item) => ({ type: item.type, url: item.url, label: item.label }));
}

function registryMedia(evidence?: CatalogSimulationEvidence | null): CatalogMedia["registry"] {
  const loop = mediaOrNull(evidence?.loop_url);
  const poster = mediaOrNull(evidence?.poster_url);
  const report = mediaOrNull(evidence?.report_url);
  return loop && poster && report ? { loop_url: loop, poster_url: poster, report_url: report } : null;
}

function coverageReportUrl(evidence?: CatalogSimulationEvidence | null): string | null {
  return mediaOrNull(evidence?.report_url);
}

function coverage(
  packageInspection: CatalogCoverage["package_inspection"],
  evidence?: CatalogSimulationEvidence | null,
): CatalogCoverage {
  const media = registryMedia(evidence);
  const rawStatus = evidence?.status;
  const status: CoverageStatus = rawStatus === "passed" || rawStatus === "failed" || rawStatus === "not-covered" || rawStatus === "not-run"
    ? rawStatus
    : media
      ? "failed"
      : "not-run";
  let finalStatus = status;
  if (finalStatus === "passed") {
    const hasIdentity = nullableSha(evidence?.evidence_key) && nullableSha(evidence?.inputs_sha256);
    const hasChecks = Array.isArray(evidence?.checks) && evidence.checks.length > 0;
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
      checks: Array.isArray(evidence?.checks) ? evidence.checks : [],
      reason: nullableString(evidence?.reason),
    },
  };
}

function sourceBase(provider: Policy["source"]["provider"], repo: string): string {
  if (provider === "github") return `https://github.com/${repo}`;
  if (provider === "huggingface-space") return `https://huggingface.co/spaces/${repo}`;
  return `https://huggingface.co/${repo}`;
}

function artifactUrl(source: Policy["source"]): string {
  if (source.provider === "github") return `https://raw.githubusercontent.com/${source.repo}/${source.revision}/${source.artifact_path}`;
  const prefix = source.provider === "huggingface-space" ? "spaces/" : "";
  return `https://huggingface.co/${prefix}${source.repo}/resolve/${source.revision}/${source.artifact_path}`;
}

function manifestObject(policy: ResolvedPolicy): Record<string, unknown> {
  return policy.resolved.manifest ?? {};
}

function manifestString(manifest: Record<string, unknown>, key: string): string | null {
  return nullableString(manifest[key]);
}

function manifestNumber(manifest: Record<string, unknown>, key: string): number | null {
  return nullableNumber(manifest[key]);
}

function nestedRecord(manifest: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = manifest[key];
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function manifestCommandEncoding(manifest: Record<string, unknown>): CatalogRuntime["command_encoding"] {
  const encoding = recordValue(manifest.command, "encoding");
  if (encoding === "constant" || encoding === "phase" || encoding === "posture_flag") return encoding;
  return encoding == null ? "absent" : null;
}

function packageInspection(policy: ResolvedPolicy): CatalogCoverage["package_inspection"] {
  const onnx = policy.resolved.onnx;
  const input = Array.isArray(onnx.input) ? onnx.input : null;
  const output = Array.isArray(onnx.output) ? onnx.output : null;
  return {
    status: input && output && onnx.smoke === "passed" ? "passed" : "failed",
    input_shape: input,
    output_shape: output,
    scope: nullableString(onnx.scope),
  };
}

function authorsForPolicy(policy: ResolvedPolicy, manifest: Record<string, unknown>): CatalogEntry["authors"] {
  if (policy.curation.authors?.length) {
    return policy.curation.authors.map((author) => ({
      name: author.name,
      affiliation: author.affiliation ?? null,
      github: author.github ?? null,
      url: author.url ?? null,
    }));
  }
  const repoOwner = policy.source.repo.split("/", 1)[0] ?? policy.source.repo;
  const author = manifestString(manifest, "author") ?? repoOwner;
  return [{ name: author, affiliation: null, github: null, url: null }];
}

function publicInstallRoute(policy: ResolvedPolicy): CatalogRuntime["install"]["route"] {
  if (policy.source.provider !== "huggingface-model" || policy.resolved.policy_set) return "review";
  return policy.resolved.install_route;
}

function installReviewReason(policy: ResolvedPolicy): string | null {
  if (policy.source.provider !== "huggingface-model") {
    return "No supported robotctl install route exists for GitHub or Hugging Face Space sources.";
  }
  if (policy.resolved.policy_set) {
    return "Official policy-set artifacts are updated as a set; no per-entry robotctl install command is synthesized.";
  }
  return nullableString(policy.resolved.install_unresolved?.[0]);
}

function installCommand(policy: ResolvedPolicy, manifest: Record<string, unknown>, route: CatalogRuntime["install"]["route"]): string | null {
  if (route === "review" || policy.source.provider !== "huggingface-model" || policy.resolved.policy_set) return null;
  const selector = policy.source.artifact_path === "policy.onnx" ? "" : `:${policy.source.artifact_path}`;
  const target = `${policy.source.repo}@${policy.source.revision}${selector}`;
  if (route === "skill") return `robotctl policy add ${policy.id} ${target}`;
  const slot = manifestString(manifest, "slot");
  return slot ? `robotctl policy load ${slot} ${target}` : null;
}

/** Resolve one authored policy into the one public CatalogEntry shape. */
export function catalogEntryFromPolicy(
  policy: ResolvedPolicy,
  evidence?: CatalogSimulationEvidence | null,
): CatalogEntry {
  const manifest = manifestObject(policy);
  const robot = nestedRecord(manifest, "robot");
  const compatibility = nestedRecord(manifest, "compatibility");
  const training = nestedRecord(manifest, "training");
  const source = policy.source;
  const route = publicInstallRoute(policy);
  const requirements = policy.curation.requirements;
  const publisherHardware = policy.curation.publisher_hardware;
  const authorMedia = authorMediaFromPolicy(policy);
  const registry = registryMedia(evidence);
  const description = policy.curation.summary ?? manifestString(manifest, "description") ?? `Policy artifact from ${source.repo}.`;
  const robotModel = nullableString(robot.model) ?? requirements?.robot_model ?? null;
  const accessories = stringArray(compatibility.accessories_required) ?? (requirements ? requirements.accessories : null);
  const terrain = stringArray(compatibility.terrain) ?? (requirements ? requirements.terrain : null);
  const trainingRepo = nullableString(training.repo);
  const trainingUrl = trainingRepo && /^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(trainingRepo)
    ? httpsOrNull(`https://github.com/${trainingRepo}`)
    : null;
  const taskId = manifestString(manifest, "task_id") ?? manifestString(manifest, "task") ?? nullableString(training.task_id);
  const packageUrl = `${sourceBase(source.provider, source.repo)}/tree/${source.revision}`;
  const artifact = artifactUrl(source);
  const unresolved = [...policy.resolved.unresolved, ...(policy.resolved.install_unresolved ?? [])];
  const simulationReason = policy.resolved.simulation.status === "not-covered"
    ? policy.resolved.simulation.reason
    : null;
  if (simulationReason && !unresolved.includes(simulationReason)) unresolved.push(simulationReason);
  const catalogEvidence = evidence ?? (simulationReason
    ? { status: "not-covered" as const, reason: simulationReason }
    : null);
  return CatalogEntrySchema.parse({
    id: policy.id,
    name: policy.curation.name ?? manifestString(manifest, "name") ?? policy.id,
    version: manifestString(manifest, "version"),
    description,
    details: policy.curation.details ?? null,
    category: policy.curation.category,
    tags: [...policy.curation.tags],
    authors: authorsForPolicy(policy, manifest),
    license: normalizeLicense(policy.curation.license ?? policy.resolved.license),
    curation: {
      summary: policy.curation.summary ?? null,
      notes: policy.curation.notes ?? null,
    },
    source: {
      kind: source.provider,
      repository_url: sourceBase(source.provider, source.repo),
      package_url: packageUrl,
      revision: source.revision,
      manifest_sha256: source.manifest_sha256,
      artifact: {
        filename: source.artifact_path.split("/").pop() ?? source.artifact_path,
        url: artifact,
        sha256: source.artifact_sha256,
      },
      upstream: {
        training_url: trainingUrl,
        simulator_url: source.provider === "huggingface-space" ? sourceBase(source.provider, source.repo) : null,
        task_id: taskId,
      },
    },
    runtime: {
      status: policy.resolved.resolution,
      kind: manifest.kind === "episodic" || manifest.kind === "perpetual" || manifest.kind === "scripted" ? manifest.kind : null,
      slot: manifestString(manifest, "slot"),
      duration_s: manifestNumber(manifest, "duration_s"),
      unwind_s: manifestNumber(manifest, "unwind_s"),
      command_encoding: manifestCommandEncoding(manifest),
      robot: {
        model: robotModel,
        hw_rev: nullableNumber(robot.hw_rev),
        servos: nullableString(robot.servos),
      },
      contract: {
        observation_dim: manifestNumber(manifest, "obs_len"),
        action_dim: manifestNumber(manifest, "action_len"),
        control_frequency_hz: nullableNumber(robot.control_hz),
        action_scale: manifestNumber(manifest, "action_scale"),
        decimation: manifestNumber(manifest, "decimation"),
        actuator_model: manifestString(manifest, "actuator_model"),
      },
      compatibility: {
        robot_model: robotModel,
        accessories_required: accessories,
        terrain,
      },
      install: {
        route,
        command: installCommand(policy, manifest, route),
        reason: route === "review" ? installReviewReason(policy) : null,
      },
      unresolved,
    },
    coverage: coverage(packageInspection(policy), catalogEvidence),
    hardware: {
      status: publisherHardware?.status === "claimed" ? "author-claimed" : "none",
      target: publisherHardware?.target ?? null,
      source_url: publisherHardware?.status === "claimed" ? publisherHardware.source_url : null,
      note: publisherHardware?.note ?? "No independent registry hardware evidence is recorded; upstream media and evaluation remain publisher claims.",
    },
    media: {
      author: authorMedia,
      registry,
      primary: registry ? "registry" : authorMedia.length > 0 ? "author" : "none",
    },
  });
}

export function catalogEntries(
  policies: ResolvedPolicy[],
  evidenceById: ReadonlyMap<string, CatalogSimulationEvidence> = new Map(),
): CatalogEntry[] {
  return policies
    .map((policy) => catalogEntryFromPolicy(policy, evidenceById.get(policy.id)))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
