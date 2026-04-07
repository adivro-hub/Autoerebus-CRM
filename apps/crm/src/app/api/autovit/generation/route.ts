import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGenerations, detectGenerationCode, isAutovitConfigured } from "@/lib/autovit-api";

/**
 * GET /api/autovit/generation?make=volvo&model=xc-60&year=2020
 * Returns all generations + auto-detected one for the given year.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAutovitConfigured()) {
    return NextResponse.json({ error: "Autovit API not configured" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const make = searchParams.get("make")?.toLowerCase();
  const model = searchParams.get("model")?.toLowerCase();
  const year = searchParams.get("year") ? Number(searchParams.get("year")) : null;

  if (!make || !model) {
    return NextResponse.json({ error: "make and model required" }, { status: 400 });
  }

  try {
    const generations = await getGenerations(make, model);
    const detected = year ? detectGenerationCode(year, generations) : null;

    return NextResponse.json({
      generations,
      detected,
      detectedLabel: detected ? generations[detected] : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Eroare" },
      { status: 500 }
    );
  }
}
