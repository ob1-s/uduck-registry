"use client";

import { useEffect, useState } from "react";
import type { Behavior } from "@registry/schema/behavior";
import { DuckMark } from "./DuckMark";

interface MediaPreviewProps {
  media: Behavior["media"];
  title: string;
  variant: "card" | "detail";
}

export function MediaPreview({ media, title, variant }: MediaPreviewProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(query.matches);

    updatePreference();
    query.addEventListener?.("change", updatePreference);
    return () => query.removeEventListener?.("change", updatePreference);
  }, []);

  const videoUrl = variant === "card"
    ? media.loop_url ?? media.video_url
    : media.video_url ?? media.loop_url;
  const imageUrl = media.thumbnail_url;
  const canUseImage = Boolean(imageUrl) && !imageFailed;
  const canUseVideo = Boolean(videoUrl) && !videoFailed;
  const preferVideo = variant === "card" || media.hero_type === "video";
  const showVideo = canUseVideo && (preferVideo || !canUseImage) && !(variant === "card" && reducedMotion && canUseImage);

  if (showVideo && videoUrl) {
    return (
      <video
        className={variant === "card" ? "behavior-thumb" : "detail-media"}
        src={videoUrl}
        poster={imageUrl}
        autoPlay={variant === "card" && !reducedMotion}
        muted={variant === "card"}
        controls={variant === "detail" || (variant === "card" && reducedMotion)}
        loop={variant === "card"}
        playsInline
        preload="metadata"
        aria-label={`${title} preview`}
        onError={() => setVideoFailed(true)}
      />
    );
  }

  if (canUseImage && imageUrl) {
    return (
      <img
        className={variant === "card" ? "behavior-thumb" : "detail-media"}
        src={imageUrl}
        alt={media.caption ?? `${title} preview`}
        loading={variant === "card" ? "lazy" : "eager"}
        decoding="async"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div
      className={`media-fallback media-fallback-${variant}`}
      role={variant === "detail" ? "img" : undefined}
      aria-label={variant === "detail" ? `${title} preview unavailable` : undefined}
      aria-hidden={variant === "card" ? true : undefined}
    >
      <DuckMark size={variant === "card" ? 48 : 84} />
      <span className={variant === "detail" ? "media-fallback-copy" : "sr-only"}>
        Preview unavailable
      </span>
    </div>
  );
}
