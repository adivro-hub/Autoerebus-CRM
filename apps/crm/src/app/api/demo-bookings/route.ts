import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";
import { getUserBrands, getTeamIdByBrand, isSupervisorForBrand } from "@/lib/team-auth";
import { findConflictingBooking, findConflictingTestDrive } from "@/lib/demo-booking-conflict";
import { sendNotification, notifyTeamSupervisors } from "@/lib/notifications/send";

/**
 * GET /api/demo-bookings
 * Query params:
 *   - filter: "mine" | "created-by-me" | "pending-approval" | "team" | "all"
 *   - brand: filter by specific brand
 *   - status: filter by status
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter") || "team";
  const brandFilter = searchParams.get("brand");
  const statusFilter = searchParams.get("status");

  const userId = session.user.id;
  const isSuperAdmin = (session.user as any).role === "SUPER_ADMIN";
  const userBrands = await getUserBrands(userId, isSuperAdmin);

  // Base where clause - restrict by user's accessible brands unless super admin
  const where: any = {};

  if (!isSuperAdmin) {
    where.brand = { in: userBrands };
  }

  if (brandFilter && userBrands.includes(brandFilter)) {
    where.brand = brandFilter;
  }

  if (statusFilter) {
    where.status = statusFilter;
  }

  // Apply filter
  if (filter === "mine") {
    where.userId = userId;
  } else if (filter === "created-by-me") {
    where.createdById = userId;
  } else if (filter === "pending-approval") {
    where.status = "PENDING";
    // Only show bookings from teams where user is supervisor
    const supervisedTeams = await prisma.teamMember.findMany({
      where: { userId, role: "SUPERVISOR" },
      select: { teamId: true },
    });
    where.teamId = { in: supervisedTeams.map((t) => t.teamId) };
  }

  const bookings = await prisma.demoBooking.findMany({
    where,
    include: {
      vehicle: {
        select: {
          id: true,
          title: true,
          make: { select: { name: true } },
          model: { select: { name: true } },
          year: true,
          images: { take: 1, orderBy: { order: "asc" }, select: { url: true } },
        },
      },
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      approvedBy: { select: { id: true, firstName: true, lastName: true } },
      cancelledBy: { select: { id: true, firstName: true, lastName: true } },
      team: { select: { id: true, name: true, brand: true } },
    },
    orderBy: { startDate: "desc" },
    take: 100,
  });

  // Batch-fetch conflicting test drive info for CONFLICTED bookings
  const conflictIds = bookings
    .filter((b) => b.status === "CONFLICTED" && b.conflictingTestDriveId)
    .map((b) => b.conflictingTestDriveId!)
    .filter((id): id is string => !!id);

  let conflictTDs: Record<string, any> = {};
  if (conflictIds.length > 0) {
    const tds = await prisma.testDrive.findMany({
      where: { id: { in: conflictIds } },
      select: {
        id: true,
        scheduledAt: true,
        duration: true,
        status: true,
        contactName: true,
        contactPhone: true,
        customer: { select: { firstName: true, lastName: true, phone: true } },
      },
    });
    conflictTDs = Object.fromEntries(tds.map((t) => [t.id, t]));
  }

  // Also, for APPROVED bookings, check if any upcoming test drive overlaps
  // (in case the trigger failed or for recent TDs)
  const bookingsWithConflict = await Promise.all(
    bookings.map(async (b) => {
      const conflictInfo = b.conflictingTestDriveId ? conflictTDs[b.conflictingTestDriveId] : null;
      return { ...b, conflictingTestDrive: conflictInfo };
    })
  );

  return NextResponse.json({ bookings: bookingsWithConflict });
}

/**
 * POST /api/demo-bookings
 * Body:
 *   vehicleId, startDate, endDate, purpose, notes,
 *   recipientType: "USER" | "CUSTOMER",
 *   userId?: string (if recipientType = USER)
 *   customerId?: string (if recipientType = CUSTOMER, existing customer)
 *   newCustomer?: { firstName, lastName, email, phone } (if creating new)
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUserId = session.user.id;
  const isSuperAdmin = (session.user as any).role === "SUPER_ADMIN";

  try {
    const body = await request.json();
    const {
      vehicleId,
      startDate,
      endDate,
      purpose,
      notes,
      recipientType,
      userId,
      customerId,
      newCustomer,
    } = body;

    if (!vehicleId || !startDate || !endDate || !purpose || !recipientType) {
      return NextResponse.json(
        { error: "Câmpuri lipsă: vehicleId, startDate, endDate, purpose, recipientType" },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return NextResponse.json({ error: "Data de sfârșit trebuie să fie după data de start" }, { status: 400 });
    }

    // Get vehicle and verify it's available for test drive
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, brand: true, availableTestDrive: true, title: true },
    });

    if (!vehicle) {
      return NextResponse.json({ error: "Vehiculul nu există" }, { status: 404 });
    }

    if (!vehicle.availableTestDrive) {
      return NextResponse.json(
        { error: "Vehiculul nu este disponibil pentru test drive/demo" },
        { status: 400 }
      );
    }

    if (vehicle.brand === "SERVICE") {
      return NextResponse.json(
        { error: "Mașinile de service nu pot fi rezervate ca demo" },
        { status: 400 }
      );
    }

    // Verify user has access to this brand
    const userBrands = await getUserBrands(currentUserId, isSuperAdmin);
    if (!userBrands.includes(vehicle.brand)) {
      return NextResponse.json(
        { error: "Nu ai acces la mașinile brandului " + vehicle.brand },
        { status: 403 }
      );
    }

    // Get the team ID for this brand
    const teamId = await getTeamIdByBrand(vehicle.brand);
    if (!teamId) {
      return NextResponse.json({ error: "Echipa pentru acest brand nu există" }, { status: 500 });
    }

    // Check conflicts
    const conflictBooking = await findConflictingBooking(vehicleId, start, end);
    if (conflictBooking) {
      return NextResponse.json(
        {
          error: "Există deja o rezervare în acest interval",
          conflict: conflictBooking,
        },
        { status: 409 }
      );
    }

    const conflictTestDrive = await findConflictingTestDrive(vehicleId, start, end);
    if (conflictTestDrive) {
      return NextResponse.json(
        {
          error: "Există un test drive programat în acest interval (test drive-urile au prioritate)",
          conflict: conflictTestDrive,
        },
        { status: 409 }
      );
    }

    // Resolve recipient
    let resolvedUserId: string | null = null;
    let resolvedCustomerId: string | null = null;

    if (recipientType === "USER") {
      if (!userId) {
        return NextResponse.json({ error: "userId este obligatoriu pentru recipientType USER" }, { status: 400 });
      }
      resolvedUserId = userId;
    } else if (recipientType === "CUSTOMER") {
      if (customerId) {
        resolvedCustomerId = customerId;
      } else if (newCustomer) {
        // Create new customer
        const { firstName, lastName, email, phone } = newCustomer;
        if (!firstName || !lastName || !phone) {
          return NextResponse.json(
            { error: "Numele și telefonul sunt obligatorii pentru client nou" },
            { status: 400 }
          );
        }
        const created = await prisma.customer.create({
          data: {
            firstName,
            lastName,
            email: email?.toLowerCase() || null,
            phone,
            type: "INDIVIDUAL",
            createdById: currentUserId,
          },
        });
        resolvedCustomerId = created.id;
      } else {
        return NextResponse.json(
          { error: "customerId sau newCustomer este obligatoriu pentru recipientType CUSTOMER" },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json({ error: "recipientType invalid" }, { status: 400 });
    }

    // Auto-approval logic:
    // - Super admin: always auto-approved
    // - Supervisor booking for themselves: auto-approved
    let status: "PENDING" | "APPROVED" = "PENDING";
    let approvedById: string | null = null;
    let approvedAt: Date | null = null;

    if (isSuperAdmin) {
      status = "APPROVED";
      approvedById = currentUserId;
      approvedAt = new Date();
    } else if (recipientType === "USER" && resolvedUserId === currentUserId) {
      const isSupervisor = await isSupervisorForBrand(currentUserId, vehicle.brand);
      if (isSupervisor) {
        status = "APPROVED";
        approvedById = currentUserId;
        approvedAt = new Date();
      }
    }

    // Create booking
    const booking = await prisma.demoBooking.create({
      data: {
        vehicleId,
        teamId,
        brand: vehicle.brand,
        recipientType,
        userId: resolvedUserId,
        customerId: resolvedCustomerId,
        createdById: currentUserId,
        startDate: start,
        endDate: end,
        purpose,
        notes: notes || null,
        status,
        approvedById,
        approvedAt,
      },
      include: {
        vehicle: { select: { id: true, title: true, brand: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
        customer: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Audit log
    await prisma.auditLog
      .create({
        data: {
          action: status === "APPROVED" ? "DEMO_BOOKING_AUTO_APPROVED" : "DEMO_BOOKING_CREATED",
          entity: "DemoBooking",
          entityId: booking.id,
          userId: currentUserId,
          details: {
            vehicleTitle: vehicle.title,
            brand: vehicle.brand,
            startDate,
            endDate,
            status,
          },
        },
      })
      .catch(() => {});

    // Prepare template data
    const creator = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { firstName: true, lastName: true },
    });

    let recipientName = "client extern";
    if (resolvedUserId) {
      const u = await prisma.user.findUnique({
        where: { id: resolvedUserId },
        select: { firstName: true, lastName: true },
      });
      recipientName = u ? `${u.firstName} ${u.lastName}` : "user";
    } else if (resolvedCustomerId) {
      const c = await prisma.customer.findUnique({
        where: { id: resolvedCustomerId },
        select: { firstName: true, lastName: true },
      });
      recipientName = c ? `${c.firstName} ${c.lastName}` : "client";
    }

    const templateData = {
      creatorName: creator ? `${creator.firstName} ${creator.lastName}` : "Admin",
      recipientName,
      vehicleTitle: vehicle.title || "—",
      startDate: start,
      endDate: end,
      purpose,
      link: `/demo-bookings/${booking.id}`,
    };

    // Fire notifications (non-blocking catch)
    if (status === "PENDING") {
      // Notify supervisors of this team
      notifyTeamSupervisors(teamId, {
        type: "DEMO_BOOKING_PENDING",
        channels: ["IN_APP", "EMAIL"],
        templateKeys: { email: "demo_booking_pending" },
        data: templateData,
        link: `/demo-bookings/${booking.id}`,
        metadata: { bookingId: booking.id },
        fallback: {
          title: "Rezervare demo nouă",
          message: `${templateData.creatorName} a creat o rezervare pentru ${templateData.vehicleTitle}.`,
          emailSubject: "Rezervare demo nouă — așteaptă aprobarea ta",
          emailBody: `${templateData.creatorName} a creat o rezervare pentru ${templateData.vehicleTitle}. Intră în CRM pentru aprobare.`,
        },
      }).catch((e) => console.error("[Notify] supervisors error:", e));
    } else if (status === "APPROVED" && resolvedUserId) {
      // Notify user (if recipient is a user)
      sendNotification({
        userId: resolvedUserId,
        type: "DEMO_BOOKING_APPROVED",
        channels: ["IN_APP", "EMAIL"],
        templateKeys: { email: "demo_booking_approved" },
        data: { ...templateData, supervisorName: templateData.creatorName },
        link: `/demo-bookings/${booking.id}`,
        metadata: { bookingId: booking.id },
        fallback: {
          title: "Rezervarea ta a fost aprobată",
          message: `Rezervarea pentru ${templateData.vehicleTitle} a fost aprobată.`,
          emailSubject: "Rezervarea ta a fost aprobată",
          emailBody: `Rezervarea pentru ${templateData.vehicleTitle} a fost aprobată automat.`,
        },
      }).catch((e) => console.error("[Notify] user error:", e));
    }

    return NextResponse.json({ success: true, booking });
  } catch (error) {
    console.error("[DemoBooking:POST] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Eroare internă" },
      { status: 500 }
    );
  }
}
