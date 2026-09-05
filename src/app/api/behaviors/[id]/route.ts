import { NextResponse } from "next/server";
import { getCatalogEntries, getCatalogEntryById } from "@/lib/registry";

// The catalog is bundled at build time and served as static Pages assets.
export const dynamic = "force-static";

export function generateStaticParams() {
  return getCatalogEntries().map((entry) => ({ id: entry.id }));
}

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Props) {
  const { id } = await params;
  const entry = getCatalogEntryById(id);

  if (!entry) {
    return NextResponse.json({ error: `Catalog entry '${id}' not found` }, { status: 404 });
  }

  return NextResponse.json(entry, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

