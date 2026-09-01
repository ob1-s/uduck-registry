/** Shared registry validation constants used by the descriptor schema and validator. */

/** Only these hosts may serve canonical ONNX artifacts (HTTPS only). */
export const HOST_ALLOWLIST = ["huggingface.co", "raw.githubusercontent.com"] as const;

/** IDs are used in registry filenames and artifact paths, so keep them simple. */
export const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** URL patterns mirror the corresponding JSON Schema definitions. */
export const HTTPS_URL_PATTERN = /^https:\/\/[^\/@?#]+(?:[\/?#].*)?$/;
export const ARTIFACT_URL_PATTERN = /^https:\/\/(?:huggingface\.co|raw\.githubusercontent\.com)(?:[\/?#].*)?$/;

/** GitHub account names used in author metadata. */
export const GITHUB_USERNAME_PATTERN = /^(?:[A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9-]{0,37}[A-Za-z0-9])$/;

/** Canonical model files are plain, single-component ONNX filenames. */
export const ONNX_FILENAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*\.onnx$/;

/** Relative paths are limited to local public assets, never protocol-relative URLs. */
export const RELATIVE_ASSET_PATH_PATTERN = /^\/(?!\/)(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/;

export function isHttpsUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.hostname !== "" &&
      HTTPS_URL_PATTERN.test(raw)
    );
  } catch {
    return false;
  }
}

export function isAllowedArtifactUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return (
      isHttpsUrl(raw) &&
      url.port === "" &&
      ARTIFACT_URL_PATTERN.test(raw) &&
      HOST_ALLOWLIST.includes(url.hostname as (typeof HOST_ALLOWLIST)[number])
    );
  } catch {
    return false;
  }
}

export function isAllowedMediaUrl(raw: string): boolean {
  return isHttpsUrl(raw) || RELATIVE_ASSET_PATH_PATTERN.test(raw);
}
