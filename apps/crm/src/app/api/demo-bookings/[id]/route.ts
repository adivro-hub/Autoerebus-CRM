import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";
import { getUserBrands } from "@/lib/team-auth";
import { findConflictingBooking, findConflictingTestDrive } from "@/lib/demo-booking-conflict";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/demo-bookings/[id]
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const booking = await prisma.demoBooking.findUnique({
    where: { id },
    include: {
      vehicle: {
        include: {
          make: { select: { name: true } },
          model: { select: { name: true } },
          images: { orderBy: { order: "asc" } },
        },
      },
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      approvedBy: { select: { id: true, firstName: true, lastName: true } },
      cancelledBy: { select: { id: true, firstName: true, lastName: true } },
      team: { select: { id: true, name: true, brand: true } },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: "Rezervarea nu există" }, { status: 404 });
  }

  // Verify user has access
  const isSuperAdmin = (session.user as any).role === "SUPER_ADMIN";
  const userBrands = await getUserBrands(session.user.id, isSuperAdmin);
  if (!userBrands.includes(booking.brand)) {
    return NextResponse.json({ error: "Nu ai acces la această rezervare" }, { status: 403 });
  }

  return NextResponse.json({ booking });
}

/**
 * PATCH /api/demo-bookings/[id]
 * Can update: startDate, endDate, purpose, notes
 * Cannot change recipient or vehicle - create a new booking instead
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const currentUserId = session.user.id;
  const isSuperAdmin = (session.user as any).role === "SUPER_ADMIN";

  const existing = await prisma.demoBooking.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Rezervarea nu există" }, { status: 404 });
  }

  // Any authenticated admin can edit any booking

  try {
    const body = await request.json();
    const { startDate, endDate, purpose, notes } = body;

    const updates: any = {};
    if (purpose !== undefined) updates.purpose = purpose;
    if (notes !== undefined) updates.notes = notes;

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start >= end) {
        return NextResponse.json({ error: "Data de sfârșit trebuie să fie după start" }, { status: 400 });
      }

      // Check conflicts (excluding this booking)
      const conflict = await findConflictingBooking(existing.vehicleId, start, end, id);
      if (conflict) {
        return NextResponse.json(
          { error: "Există altă rezervare în acest interval", conflict },
          { status: 409 }
        );
      }

      const conflictTD = await findConflictingTestDrive(existing.vehicleId, start, end);
      if (conflictTD) {
        return NextResponse.json(
          { error: "Există un test drive programat în acest interval", conflict: conflictTD },
          { status: 409 }
        );
      }

      updates.startDate = start;
      updates.endDate = end;
    }

    const updated = await prisma.demoBooking.update({
      where: { id },
      data: updates,
      include: {
        vehicle: { select: { title: true, brand: true } },
        user: { select: { firstName: true, lastName: true } },
        customer: { select: { firstName: true, lastName: true } },
      },
    });

    await prisma.auditLog
      .create({
        data: {
          action: "DEMO_BOOKING_UPDATED",
          entity: "DemoBooking",
          entityId: id,
          userId: currentUserId,
          details: updates,
        },
      })
      .catch(() => {});

    return NextResponse.json({ success: true, booking: updated });
  } catch (error) {
    console.error("[DemoBooking:PATCH] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Eroare internă" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/demo-bookings/[id]
 * Cancel the booking (sets status to CANCELLED)
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const currentUserId = session.user.id;
  const isSuperAdmin = (session.user as any).role === "SUPER_ADMIN";

  const existing = await prisma.demoBooking.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Rezervarea nu există" }, { status: 404 });
  }

  if (["CANCELLED", "COMPLETED"].includes(existing.status)) {
    return NextResponse.json({ error: "Rezervarea nu mai poate fi anulată" }, { status: 400 });
  }

  // Any authenticated admin can cancel any booking

  const body = await request.json().catch(() => ({}));
  const reason = body?.reason || null;

  const cancelled = await prisma.demoBooking.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancelledById: currentUserId,
      cancelledAt: new Date(),
      cancelledReason: reason,
    },
  });

  await prisma.auditLog
    .create({
      data: {
        action: "DEMO_BOOKING_CANCELLED",
        entity: "DemoBooking",
        entityId: id,
        userId: currentUserId,
        details: { reason },
      },
    })
    .catch(() => {});

  return NextResponse.json({ success: true, booking: cancelled });
}
