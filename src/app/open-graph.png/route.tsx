import { ImageResponse } from "next/og";
import { getRegistryStats } from "@/lib/registry";
import { SOCIAL_IMAGE_SIZE } from "@/lib/site";
import { HomeSocialCard } from "@/components/social/HomeSocialCard";

export const dynamic = "force-static";
export const runtime = "nodejs";

export async function GET() {
  return new ImageResponse(
    <HomeSocialCard stats={getRegistryStats()} variant="openGraph" />,
    SOCIAL_IMAGE_SIZE,
  );
}
