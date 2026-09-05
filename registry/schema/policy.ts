import { z } from 'zod';
import { BehaviorCategorySchema } from './behavior';
import { isHttpsUrl } from './allowlist';

/** Authored state: immutable upstream pointer and editorial choices only. */
export const PolicyPointerSchema = z.strictObject({
  id: z.string().max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  source: z.strictObject({
    repo: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/),
    revision: z.string().regex(/^[a-f0-9]{40}$/),
    artifact_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    manifest_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  curation: z.strictObject({
    category: BehaviorCategorySchema,
    tags: z.array(z.string().min(1).max(80)).max(20).default([]),
    summary: z.string().max(4000).optional(),
    notes: z.string().max(4000).optional(),
  }),
  media: z.array(z.strictObject({
    type: z.enum(['image', 'video']),
    url: z.string().refine(isHttpsUrl),
    label: z.string(),
  })).max(10).optional(),
});
export type PolicyPointer = z.infer<typeof PolicyPointerSchema>;
export interface ResolvedPolicy extends PolicyPointer {
  resolved: {
    source: PolicyPointer['source'];
    manifest: Record<string, unknown>;
    license: string | null;
    runtime: 'pollen-hub' | 'pollen-review';
    install_route: 'skill' | 'slot' | 'review';
    unresolved: string[];
    onnx: { input: unknown[]; output: unknown[]; smoke: string; scope: string };
    simulation:
      | { status: 'covered'; runner: string; recipe: Record<string, unknown>; scope: string }
      | { status: 'not-covered'; reason: string };
  };
}
