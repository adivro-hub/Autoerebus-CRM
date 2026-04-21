import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";
import type { Prisma } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { id } = await params;
  const offer = await prisma.serviceOffer.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  if (!offer) {
    return NextResponse.json(
      { success: false, error: "Oferta nu a fost găsită" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: offer });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.serviceOffer.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Oferta nu a fost găsită" },
      { status: 404 }
    );
  }

  const data: Prisma.ServiceOfferUpdateInput = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.description !== undefined) data.description = body.description;
  if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl;
  if (body.imageCloudinaryId !== undefined)
    data.imageCloudinaryId = body.imageCloudinaryId || null;
  if (body.brand !== undefined) data.brand = body.brand;
  if (body.validityText !== undefined)
    data.validityText = body.validityText || null;
  if (body.order !== undefined) data.order = Number(body.order);
  if (body.active !== undefined) data.active = body.active;
  if (body.ctaUrl !== undefined) data.ctaUrl = body.ctaUrl || null;

  // If image was replaced, delete old Cloudinary asset
  if (
    body.imageCloudinaryId !== undefined &&
    existing.imageCloudinaryId &&
    existing.imageCloudinaryId !== body.imageCloudinaryId
  ) {
    try {
      await cloudinary.uploader.destroy(existing.imageCloudinaryId);
    } catch (err) {
      console.warn("Failed to delete old Cloudinary asset:", err);
    }
  }

  try {
    const offer = await prisma.serviceOffer.update({ where: { id }, data });
    return NextResponse.json({ success: true, data: offer });
  } catch (error) {
    console.error("Update offer error:", error);
    return NextResponse.json(
      { success: false, error: "Eroare la actualizarea ofertei" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { id } = await params;

  const offer = await prisma.serviceOffer.findUnique({ where: { id } });
  if (!offer) {
    return NextResponse.json(
      { success: false, error: "Oferta nu a fost găsită" },
      { status: 404 }
    );
  }

  if (offer.imageCloudinaryId) {
    try {
      await cloudinary.uploader.destroy(offer.imageCloudinaryId);
    } catch (err) {
      console.warn("Failed to delete Cloudinary asset:", err);
    }
  }

  try {
    await prisma.serviceOffer.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete offer error:", error);
    return NextResponse.json(
      { success: false, error: "Eroare la ștergerea ofertei" },
      { status: 500 }
    );
  }
}
