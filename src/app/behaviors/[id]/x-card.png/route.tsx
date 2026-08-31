import { ImageResponse } from "next/og";
import { getAllBehaviors, getBehaviorById } from "@/lib/registry";
import { SOCIAL_IMAGE_SIZE } from "@/lib/site";
import { BehaviorSocialCard } from "@/components/social/BehaviorSocialCard";

export const dynamic = "force-static";
export const runtime = "nodejs";

interface RouteProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return getAllBehaviors().map((behavior) => ({ id: behavior.id }));
}

export async function GET(_request: Request, { params }: RouteProps) {
  const { id } = await params;
  const behavior = getBehaviorById(id);
  if (!behavior) return new Response("Not found", { status: 404 });

  return new ImageResponse(
    <BehaviorSocialCard behavior={behavior} variant="twitter" />,
    SOCIAL_IMAGE_SIZE,
  );
}
