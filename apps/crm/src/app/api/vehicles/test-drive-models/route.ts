import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@autoerebus/database";

/**
 * GET /api/vehicles/test-drive-models?brand=NISSAN
 *
 * Public endpoint used by consumer websites (Nissan, Renault, etc.)
 * to know which models currently have at least one vehicle available
 * for test drive (availableTestDrive = true, status IN_STOCK).
 *
 * Authentication: x-api-key header (same key set used by the other
 * external endpoints — NISSAN_API_KEY, RENAULT_API_KEY, etc).
 *
 * Response: `{ success: true, data: ["qashqai", "juke", ...] }`
 * — model names are lowercased and space-collapsed to dashes so the
 * consumer can do a simple includes() check against its route slug.
 */

const API_KEYS: Record<string, string> = {
  [process.env.NISSAN_API_KEY ?? "nissan-autoerebus-key"]: "NISSAN",
  [process.env.RENAULT_API_KEY ?? "renault-autoerebus-key"]: "RENAULT",
  [process.env.AUTORULATE_API_KEY ?? "autorulate-autoerebus-key"]: "AUTORULATE",
};

function normalize(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  const keyBrand = apiKey ? API_KEYS[apiKey] : null;

  if (!keyBrand) {
    return NextResponse.json(
      { success: false, error: "Invalid API key" },
      { status: 401 }
    );
  }

  // Allow explicit ?brand=… but default to the key's brand for safety.
  const qBrand = request.nextUrl.searchParams.get("brand");
  const brand = (qBrand || keyBrand) as "NISSAN" | "RENAULT" | "AUTORULATE";

  try {
    const vehicles = await prisma.vehicle.findMany({
      where: {
        brand,
        availableTestDrive: true,
        status: "IN_STOCK",
      },
      select: {
        model: { select: { name: true } },
      },
    });

    const slugs = Array.from(
      new Set(vehicles.map((v) => normalize(v.model.name)).filter(Boolean))
    ).sort();

    return NextResponse.json(
      { success: true, data: slugs },
      {
        headers: {
          // Short cache — websites refresh list periodically but we
          // don't want stale availability.
          "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("[vehicles/test-drive-models] error:", error);
    return NextResponse.json(
      { success: false, data: [] },
      { status: 500 }
    );
  }
}
