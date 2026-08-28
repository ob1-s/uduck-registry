import { NextResponse } from "next/server";
import { getBehaviorById } from "@/lib/registry";

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Props) {
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
