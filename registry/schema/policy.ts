import { z } from "zod";
import { GITHUB_USERNAME_PATTERN, ID_PATTERN, isHttpsUrl } from "./allowlist";

const strict = <T extends z.ZodRawShape>(shape: T) => z.strictObject(shape);
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const RevisionSchema = z.string().regex(/^[a-f0-9]{40}$/);
const RepositorySchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/);
const RelativePathSchema = z.string().regex(
  /^(?!\/)(?!.*(?:^|\/)\.\.?(?:\/|$))[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/,
  "Must be a safe relative upstream path",
);
const HttpsUrlSchema = z.string().url().refine(isHttpsUrl, {
  message: "Must be a valid https:// URL without embedded credentials",
});

export const PolicyProviderSchema = z.enum(["github", "huggingface-model", "huggingface-space"]);
export type PolicyProvider = z.infer<typeof PolicyProviderSchema>;

export const PolicyCategorySchema = z.enum([
  "locomotion",
  "agility-tricks",
  "manipulation",
  "recovery",
  "roller-skate",
  "experimental",
]);
export type PolicyCategory = z.infer<typeof PolicyCategorySchema>;

export const PolicyAuthorSchema = strict({
  name: z.string().min(1).max(200),
  affiliation: z.string().min(1).max(200).optional(),
  github: z.string().regex(GITHUB_USERNAME_PATTERN).optional(),
  url: HttpsUrlSchema.optional(),
});
export type PolicyAuthor = z.infer<typeof PolicyAuthorSchema>;

const PolicySourceSchema = strict({
  provider: PolicyProviderSchema,
  repo: RepositorySchema,
  revision: RevisionSchema,
  artifact_path: RelativePathSchema.refine((value) => value.toLowerCase().endsWith(".onnx"), "Artifact must be an ONNX file"),
  artifact_sha256: Sha256Schema,
  manifest_path: RelativePathSchema.nullable(),
  manifest_sha256: Sha256Schema.nullable(),
}).superRefine((source, context) => {
  if ((source.manifest_path === null) !== (source.manifest_sha256 === null)) {
    context.addIssue({
      code: "custom",
      path: ["manifest_path"],
      message: "manifest_path and manifest_sha256 must be both present or both null",
    });
  }
});
export type PolicySource = z.infer<typeof PolicySourceSchema>;

const PolicyMediaSchema = z.array(strict({
  type: z.enum(["image", "video"]),
  url: HttpsUrlSchema,
  label: z.string().min(1).max(240),
})).max(20);

const PolicyCurationSchema = strict({
  category: PolicyCategorySchema,
  tags: z.array(z.string().min(1).max(80)).max(20).default([]),
  name: z.string().min(2).max(200).optional(),
  summary: z.string().min(1).max(4000).optional(),
  details: z.string().min(1).max(8000).optional(),
  authors: z.array(PolicyAuthorSchema).min(1).max(20).optional(),
  license: z.string().min(1).max(200).optional(),
  notes: z.string().min(1).max(4000).optional(),
});

/** The only authored registry format: an immutable source plus curation. */
export const PolicySchema = strict({
  id: z.string().regex(ID_PATTERN, "Must be a lowercase kebab-case slug").max(100),
  source: PolicySourceSchema,
  curation: PolicyCurationSchema,
  media: PolicyMediaSchema.optional(),
});
export type Policy = z.infer<typeof PolicySchema>;

export interface ResolvedPolicy extends Policy {
  resolved: {
    source: PolicySource;
    manifest: Record<string, unknown> | null;
    license: string | null;
    resolution: "ready" | "review";
    install_route: "skill" | "slot" | "review";
    unresolved: string[];
    onnx: { input: unknown[]; output: unknown[]; smoke: string; scope: string };
    simulation:
      | { status: "covered"; recipe: Record<string, unknown>; scope: string }
      | { status: "not-covered"; reason: string };
  };
}
