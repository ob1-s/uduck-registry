import { NextResponse } from "next/server";
import { getAllBehaviors } from "@/lib/registry";

export async function GET() {
  const behaviors = getAllBehaviors();
  const payload = {
    version: "0.1.0",
    updated_at: new Date().toISOString(),
    count: behaviors.length,
    behaviors,
  };

  return NextResponse.json(payload, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
