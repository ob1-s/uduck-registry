import type { CatalogEntry, CatalogHardware, CatalogRuntime } from "@registry/schema/catalog";

export interface CatalogPreviewMedia {
  thumbnail_url?: string;
  loop_url?: string;
  video_url?: string;
  hero_type: "video" | "image" | "badge";
  caption?: string;
}

export function primaryMedia(entry: CatalogEntry): CatalogPreviewMedia {
  const registry = entry.media.registry;
  if (entry.media.primary === "registry" && registry) {
    return {
      thumbnail_url: registry.poster_url,
      loop_url: registry.loop_url,
      video_url: registry.loop_url,
      hero_type: "video",
      caption: "Registry-owned diagnostic render",
    };
  }

  const image = entry.media.author.find((item) => item.type === "image");
  const video = entry.media.author.find((item) => item.type === "video");
  return {
    ...(image ? { thumbnail_url: image.url } : {}),
    ...(video ? { loop_url: video.url, video_url: video.url } : {}),
    hero_type: video ? "video" : image ? "image" : "badge",
    caption: image?.label ?? video?.label,
  };
}

export function hardwareLabel(status: CatalogHardware["status"]): string {
  if (status === "maintainer-verified") return "Hardware verified";
  if (status === "author-claimed") return "Hardware claimed";
  return "No hardware evidence";
}

export function coverageLabel(status: CatalogEntry["coverage"]["registry_simulation"]["status"]): string {
  if (status === "passed") return "Simulation passed";
  if (status === "failed") return "Simulation failed";
  if (status === "not-covered") return "Simulation not covered";
  return "Simulation not run";
}

export function runtimeLabel(runtime: CatalogRuntime): string {
  if (runtime.classification === "pollen-hub") return "Pollen Hub package";
  if (runtime.classification === "pollen-review") return "Pollen package · review needed";
  return "Manual registry entry";
}

export function runtimeKindLabel(kind: CatalogRuntime["kind"]): string {
  if (!kind) return "Kind unknown";
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

export function catalogSearchText(entry: CatalogEntry): string {
  return [
    entry.id,
    entry.name,
    entry.description,
    entry.category,
    ...entry.tags,
    ...entry.authors.map((author) => author.name),
    entry.source.repository_url ?? "",
    entry.source.upstream.task_id ?? "",
    entry.runtime.kind ?? "",
    entry.runtime.slot ?? "",
    entry.runtime.compatibility.robot_model ?? "",
    ...(entry.runtime.compatibility.accessories_required ?? []),
    ...(entry.runtime.compatibility.terrain ?? []),
  ].join(" ").toLowerCase();
}

