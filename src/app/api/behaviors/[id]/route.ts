import { NextResponse } from "next/server";
import { getAllBehaviors, getBehaviorById } from "@/lib/registry";

// The catalog is bundled at build time and served as static Pages assets.
export const dynamic = "force-static";

export function generateStaticParams() {
  return getAllBehaviors().map((behavior) => ({ id: behavior.id }));
}

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Props) {
  const { id } = await params;
  const behavior = getBehaviorById(id);

  if (!behavior) {
    return NextResponse.json({ error: `Behavior '${id}' not found` }, { status: 404 });
  }

  return NextResponse.json(behavior, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
