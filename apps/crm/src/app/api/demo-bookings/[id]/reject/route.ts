import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";
import { sendNotification } from "@/lib/notifications/send";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/demo-bookings/[id]/reject
 * Body: { reason: string }
 */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const currentUserId = session.user.id;
  const isSuperAdmin = (session.user as any).role === "SUPER_ADMIN";

  const body = await request.json().catch(() => ({}));
  const reason = body?.reason?.trim();
  if (!reason) {
    return NextResponse.json({ error: "Motivul respingerii este obligatoriu" }, { status: 400 });
  }

  const booking = await prisma.demoBooking.findUnique({ where: { id } });
  if (!booking) {
    return NextResponse.json({ error: "Rezervarea nu există" }, { status: 404 });
  }

  if (booking.status !== "PENDING") {
    return NextResponse.json({ error: "Rezervarea nu este în așteptare" }, { status: 400 });
  }

  if (!isSuperAdmin) {
    const isSupervisor = await prisma.teamMember.findFirst({
      where: { userId: currentUserId, teamId: booking.teamId, role: "SUPERVISOR" },
    });
    if (!isSupervisor) {
      return NextResponse.json(
        { error: "Doar supervizorii echipei pot respinge rezervări" },
        { status: 403 }
      );
    }
  }

  const rejected = await prisma.demoBooking.update({
    where: { id },
    data: {
      status: "REJECTED",
      approvedById: currentUserId,
      approvedAt: new Date(),
      rejectedReason: reason,
    },
    include: {
      vehicle: { select: { title: true, brand: true } },
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      customer: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  await prisma.auditLog
    .create({
      data: {
        action: "DEMO_BOOKING_REJECTED",
        entity: "DemoBooking",
        entityId: id,
        userId: currentUserId,
        details: { reason },
      },
    })
    .catch(() => {});

  // Notify recipient with reason
  if (rejected.user) {
    sendNotification({
      userId: rejected.user.id,
      type: "DEMO_BOOKING_REJECTED",
      channels: ["IN_APP", "EMAIL"],
      templateKeys: { email: "demo_booking_rejected" },
      data: {
        recipientName: `${rejected.user.firstName} ${rejected.user.lastName}`,
        vehicleTitle: rejected.vehicle.title || "—",
        startDate: rejected.startDate,
        endDate: rejected.endDate,
        reason,
        link: `/demo-bookings/${id}`,
      },
      link: `/demo-bookings/${id}`,
      metadata: { bookingId: id, reason },
      fallback: {
        title: "Rezervarea ta a fost respinsă",
        message: `Rezervarea pentru ${rejected.vehicle.title} a fost respinsă: ${reason}`,
      },
    }).catch((e) => console.error("[Notify:reject] error:", e));
  }

  return NextResponse.json({ success: true, booking: rejected });
}
