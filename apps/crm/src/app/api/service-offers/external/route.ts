import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@autoerebus/database";
import type { Prisma } from "@prisma/client";

/**
 * GET /api/service-offers/external?brand=SERVICE
 *
 * Public endpoint consumed by the public Autoerebus service websites.
 * Returns only ACTIVE offers for the given brand.
 *
 * Auth: `x-api-key` header must match EXTERNAL_API_KEY env var.
 * (This is the Next.js CRM app's public endpoint — mirrors what exists
 * on the separate Express API at services/api.)
 */
export async function GET(request: NextRequest) {
  const key = request.headers.get("x-api-key");
  const expected = process.env.EXTERNAL_API_KEY;

  if (!expected) {
    return NextResponse.json(
      { success: false, error: "API key not configured" },
      { status: 503 }
    );
  }
  if (key !== expected) {
    return NextResponse.json(
      { success: false, error: "API key invalid" },
      { status: 401 }
    );
  }

  const brand = request.nextUrl.searchParams.get("brand");
  const where: Prisma.ServiceOfferWhereInput = { active: true };
  if (brand) {
    where.brand = brand as Prisma.ServiceOfferWhereInput["brand"];
  }

  try {
    const offers = await prisma.serviceOffer.findMany({
      where,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        brand: true,
        validityText: true,
        order: true,
        ctaUrl: true,
      },
    });
    return NextResponse.json({ success: true, data: offers });
  } catch (error) {
    console.error("[service-offers/external] error:", error);
    return NextResponse.json(
      { success: false, data: [] },
      { status: 500 }
    );
  }
}
