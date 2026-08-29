/**
 * Shared artifact-integrity constants. Used by the CLI, the validator, and CI
 * so `uduck validate` is byte-identical to CI's checks.
 */

/** Only these hosts may serve canonical ONNX artifacts (HTTPS only). */
export const HOST_ALLOWLIST = ["huggingface.co", "raw.githubusercontent.com"];

export function isAllowedArtifactUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && HOST_ALLOWLIST.includes(url.hostname);
  } catch {
    return false;
  }
}

/** Behavior IDs are `<owner-slug>/<kebab-id>`-safe slugs used in fs paths. */
export const ID_PATTERN = /^[a-zA-Z0-9-_]+$/;
