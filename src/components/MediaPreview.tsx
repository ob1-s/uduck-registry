"use client";

import { useEffect, useState } from "react";
import { Play } from "lucide-react";
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
  const [wideMedia, setWideMedia] = useState(false);
  const [thumbnailReady, setThumbnailReady] = useState(variant !== "card" || !media.thumbnail_url);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (variant !== "card" || !media.thumbnail_url) {
      setThumbnailReady(true);
      return;
    }

    const thumbnail = new Image();
    thumbnail.onload = () => {
      setWideMedia(thumbnail.naturalHeight > 0 && thumbnail.naturalWidth / thumbnail.naturalHeight > 1.6);
      setThumbnailReady(true);
    };
    thumbnail.onerror = () => setThumbnailReady(true);
    thumbnail.src = media.thumbnail_url;

    return () => {
      thumbnail.onload = null;
      thumbnail.onerror = null;
    };
  }, [media.thumbnail_url, variant]);

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
  const cardVideoReady = variant !== "card" || !imageUrl || thumbnailReady;
  const showVideo = canUseVideo
    && (preferVideo || !canUseImage)
    && cardVideoReady
    && !(variant === "card" && wideMedia && canUseImage)
    && !(variant === "card" && reducedMotion && canUseImage);
  const mediaClass = variant === "card"
    ? `behavior-thumb${wideMedia ? " behavior-thumb-wide" : ""}`
    : "detail-media";
  const showVideoCue = variant === "card" && wideMedia && canUseVideo;
  const videoCue = showVideoCue ? (
    <span className="behavior-media-cue" aria-hidden="true">
      <Play size={10} fill="currentColor" />
      Watch
    </span>
  ) : null;

  if (showVideo && videoUrl) {
    return (
      <>
        <video
          className={mediaClass}
          src={videoUrl}
          poster={imageUrl}
          autoPlay={variant === "card" && !reducedMotion}
          muted={variant === "card"}
          controls={variant === "detail" || (variant === "card" && reducedMotion)}
          loop={variant === "card"}
          playsInline
          preload="metadata"
          aria-label={`${title} preview`}
          onLoadedMetadata={(event) => {
            const { videoWidth, videoHeight } = event.currentTarget;
            const isWide = videoHeight > 0 && videoWidth / videoHeight > 1.6;

            if (variant === "card" && isWide) setWideMedia(true);
          }}
          onError={() => setVideoFailed(true)}
        />
        {videoCue}
      </>
    );
  }

  if (canUseImage && imageUrl) {
    return (
      <>
        <img
          className={mediaClass}
          src={imageUrl}
          alt={media.caption ?? `${title} preview`}
          loading={variant === "card" ? "lazy" : "eager"}
          decoding="async"
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget;

            if (variant === "card" && naturalHeight > 0 && naturalWidth / naturalHeight > 1.6) {
              setWideMedia(true);
            }
            if (variant === "card") setThumbnailReady(true);
          }}
          onError={() => {
            setImageFailed(true);
            if (variant === "card") setThumbnailReady(true);
          }}
        />
        {videoCue}
      </>
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
