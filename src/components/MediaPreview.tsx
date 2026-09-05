"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Play } from "lucide-react";
import type { CatalogPreviewMedia } from "@/lib/catalog";
import { DuckMark } from "./DuckMark";

interface MediaPreviewProps {
  media: CatalogPreviewMedia;
  title: string;
  variant: "card" | "detail";
}

export function MediaPreview({ media, title, variant }: MediaPreviewProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [wideMedia, setWideMedia] = useState(false);
  const [thumbnailReady, setThumbnailReady] = useState(variant !== "card" || !media.thumbnail_url);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [inViewport, setInViewport] = useState(variant !== "card");
  const observerRef = useRef<IntersectionObserver | null>(null);
  const videoTimerRef = useRef<number | null>(null);

  // Viewport tracking attaches only to the always-present card fallback layer
  // (not to the media elements), so observation survives every media swap,
  // unmount, and retry without ever leaving the card in a dead state.
  const observeMedia = useCallback((node: Element | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;

    if (variant !== "card" || !node) return;
    if (typeof IntersectionObserver === "undefined") {
      setInViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setInViewport(entry.isIntersecting),
      { rootMargin: "200px 0px" },
    );
    observer.observe(node);
    observerRef.current = observer;
  }, [variant]);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  const clearVideoTimer = useCallback(() => {
    if (videoTimerRef.current !== null) {
      window.clearTimeout(videoTimerRef.current);
      videoTimerRef.current = null;
    }
  }, []);

  // Card media is statically prerendered, so images often finish loading
  // BEFORE hydration attaches the onLoad listener — the event is then missed
  // and the layer would sit at opacity 0 forever. Syncing from the element
  // on ref attach (complete/readyState) makes the reveal stateless against
  // that race. Safe to call repeatedly; it only ever converges.
  const syncImageState = useCallback((node: HTMLImageElement) => {
    if (!node.complete) return;

    const { naturalWidth, naturalHeight } = node;

    if (naturalWidth === 0) {
      setImageFailed(true);
      if (variant === "card") setThumbnailReady(true);
      return;
    }

    setImageLoaded(true);
    if (variant === "card" && naturalHeight > 0 && naturalWidth / naturalHeight > 1.6) {
      setWideMedia(true);
    }
    if (variant === "card") setThumbnailReady(true);
  }, [variant]);

  const imageRef = useCallback((node: HTMLImageElement | null) => {
    if (node) syncImageState(node);
  }, [syncImageState]);

  const videoRef = useCallback((node: HTMLVideoElement | null) => {
    // HAVE_CURRENT_DATA (2) = at least the first frame is available.
    if (node && node.readyState >= 2) {
      setVideoReady(true);
      clearVideoTimer();
    }
  }, [clearVideoTimer]);

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
    && (variant !== "card" || inViewport)
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

  useEffect(() => {
    if (variant !== "card" || !showVideo || reducedMotion) return;

    videoTimerRef.current = window.setTimeout(() => {
      videoTimerRef.current = null;
      setVideoFailed(true);
    }, 8000);

    return clearVideoTimer;
  }, [clearVideoTimer, reducedMotion, showVideo, variant]);

  // Reset video reveal when the video unmounts (e.g. leaving the viewport)
  // or switches source, so the fade-in can replay on the fresh element.
  // (Images don't need this: their keyed remount re-runs imageRef, which
  // syncs from element state — including the cached-and-already-complete
  // case that the hydration race makes untrustworthy via events alone.)
  useEffect(() => setVideoReady(false), [videoUrl, showVideo]);

  // Cards crossfade: when the media layer reveals, the duck fallback fades
  // out — necessary because the Pollen clips are alpha-transparent WebMs,
  // so an opaque-feeling video would still show the duck through it.
  const mediaRevealed = showVideo ? videoReady : imageLoaded;
  const layerClass = variant === "card"
    ? ` media-layer${mediaRevealed ? " media-ready" : ""}`
    : "";

  let mediaNode: ReactNode = null;
  if (showVideo && videoUrl) {
    mediaNode = (
      <video
        key={videoUrl}
        ref={videoRef}
        className={mediaClass + layerClass}
        src={videoUrl}
        poster={imageUrl ?? undefined}
        autoPlay={variant === "card" && !reducedMotion}
        muted={variant === "card"}
        controls={variant === "detail" || (variant === "card" && reducedMotion)}
        loop={variant === "card"}
        playsInline
        preload={!imageUrl ? "metadata" : "none"}
        aria-label={`${title} preview`}
        onCanPlay={() => {
          setVideoReady(true);
          clearVideoTimer();
        }}
        onLoadedMetadata={(event) => {
          const { videoWidth, videoHeight } = event.currentTarget;
          const isWide = videoHeight > 0 && videoWidth / videoHeight > 1.6;

          if (variant === "card" && isWide) setWideMedia(true);
        }}
        onError={() => {
          clearVideoTimer();
          setVideoReady(false);
          setVideoFailed(true);
        }}
      />
    );
  } else if (canUseImage && imageUrl) {
    mediaNode = (
      <img
        key={imageUrl}
        ref={imageRef}
        className={mediaClass + layerClass}
        src={imageUrl}
        alt={media.caption ?? `${title} preview`}
        loading={variant === "card" ? "lazy" : "eager"}
        decoding="async"
        onLoad={(event) => syncImageState(event.currentTarget)}
        onError={() => {
          setImageFailed(true);
          if (variant === "card") setThumbnailReady(true);
        }}
      />
    );
  }

  // Cards keep the duck visible underneath at all times: media fades in over
  // it, so a slow network shows the mascot instead of an empty frame.
  if (variant === "card") {
    return (
      <>
        <div
          ref={observeMedia}
          className={`media-fallback media-fallback-card${mediaRevealed ? " media-fallback-hidden" : ""}`}
          aria-hidden="true"
        >
          <DuckMark size={48} />
        </div>
        {mediaNode}
        {videoCue}
      </>
    );
  }

  if (mediaNode) {
    return (
      <>
        {mediaNode}
        {videoCue}
      </>
    );
  }

  return (
    <div
      className={`media-fallback media-fallback-${variant}`}
      role="img"
      aria-label={`${title} preview unavailable`}
    >
      <DuckMark size={84} />
      <span className="media-fallback-copy">Preview unavailable</span>
    </div>
  );
}
