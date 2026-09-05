import { ImageResponse } from "next/og";
import { getCatalogEntries, getCatalogEntryById } from "@/lib/registry";
import { SOCIAL_IMAGE_SIZE } from "@/lib/site";
import { BehaviorSocialCard } from "@/components/social/BehaviorSocialCard";

export const dynamic = "force-static";
export const runtime = "nodejs";

interface RouteProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return getCatalogEntries().map((entry) => ({ id: entry.id }));
}

export async function GET(_request: Request, { params }: RouteProps) {
  const { id } = await params;
  const entry = getCatalogEntryById(id);
  if (!entry) return new Response("Not found", { status: 404 });

  return new ImageResponse(
    <BehaviorSocialCard entry={entry} variant="twitter" />,
    SOCIAL_IMAGE_SIZE,
  );
}
