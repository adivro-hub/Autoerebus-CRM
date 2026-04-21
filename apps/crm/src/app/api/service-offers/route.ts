import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";
import type { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const brand = searchParams.get("brand");
  const active = searchParams.get("active");
  const search = searchParams.get("search");

  const where: Prisma.ServiceOfferWhereInput = {};
  if (brand) where.brand = brand as Prisma.ServiceOfferWhereInput["brand"];
  if (active !== null) where.active = active === "true";
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  try {
    const offers = await prisma.serviceOffer.findMany({
      where,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
    return NextResponse.json({ success: true, data: offers });
  } catch (error) {
    console.error("List offers error:", error);
    return NextResponse.json(
      { success: false, error: "Eroare la listarea ofertelor" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const body = await request.json();
  const {
    title,
    description,
    imageUrl,
    imageCloudinaryId,
    brand,
    validityText,
    order,
    active,
    ctaUrl,
  } = body;

  if (!title || !description || !imageUrl || !brand) {
    return NextResponse.json(
      {
        success: false,
        error: "title, description, imageUrl și brand sunt obligatorii",
      },
      { status: 400 }
    );
  }

  try {
    const offer = await prisma.serviceOffer.create({
      data: {
        title,
        description,
        imageUrl,
        imageCloudinaryId: imageCloudinaryId || null,
        brand,
        validityText: validityText || null,
        order: order ?? 0,
        active: active ?? true,
        ctaUrl: ctaUrl || null,
        createdById: (session.user as { id: string }).id,
      },
    });
    return NextResponse.json({ success: true, data: offer }, { status: 201 });
  } catch (error) {
    console.error("Create offer error:", error);
    return NextResponse.json(
      { success: false, error: "Eroare la crearea ofertei" },
      { status: 500 }
    );
  }
}
