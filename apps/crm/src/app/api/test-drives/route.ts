import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";
import { handleTestDriveConflictWithDemoBookings } from "@/lib/demo-booking-trigger";
import { createGoogleEvent } from "@/lib/google-calendar";

// GET - fetch test drive vehicles and customers for the form
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  // Get vehicles available for test drive
  if (type === "vehicles") {
    const brand = searchParams.get("brand");
    const where: Record<string, unknown> = { availableTestDrive: true };
    if (brand && brand !== "ALL") where.brand = brand;

    const vehicles = await prisma.vehicle.findMany({
      where,
      select: {
        id: true,
        title: true,
        year: true,
        brand: true,
        make: { select: { name: true } },
        model: { select: { name: true } },
      },
      orderBy: [{ make: { name: "asc" } }, { model: { name: "asc" } }],
    });

    return NextResponse.json(vehicles);
  }

  // Get customers for selection
  if (type === "customers") {
    const search = searchParams.get("search") ?? "";
    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
      },
      take: 20,
      orderBy: { firstName: "asc" },
    });

    return NextResponse.json(customers);
  }

  // Get agents
  if (type === "agents") {
    const agents = await prisma.user.findMany({
      where: { active: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
      orderBy: { firstName: "asc" },
    });

    return NextResponse.json(agents);
  }

  // Get scheduled test drives for a vehicle in a date range
  // Used by demo booking modal to show upcoming test drives
  if (type === "byVehicle") {
    const vehicleId = searchParams.get("vehicleId");
    if (!vehicleId) {
      return NextResponse.json({ error: "vehicleId required" }, { status: 400 });
    }
    const daysAhead = parseInt(searchParams.get("daysAhead") || "14", 10);
    const now = new Date();
    const until = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const testDrives = await prisma.testDrive.findMany({
      where: {
        vehicleId,
        status: { in: ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"] },
        scheduledAt: { gte: now, lte: until },
      },
      select: {
        id: true,
        vehicleId: true,
        scheduledAt: true,
        duration: true,
        status: true,
        contactName: true,
        contactPhone: true,
        customer: { select: { firstName: true, lastName: true, phone: true } },
      },
      orderBy: { scheduledAt: "asc" },
    });

    return NextResponse.json({ testDrives });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}

// POST - create a new test drive
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const { vehicleId, customerId, scheduledAt, duration, agentId, notes, brand, contactName, contactPhone, contactEmail, status, adminOverride } = body;

    if (!vehicleId || !customerId || !scheduledAt) {
      return NextResponse.json(
        { error: "Vehicul, client si data sunt obligatorii" },
        { status: 400 }
      );
    }

    // Verify vehicle is available for test drive
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { availableTestDrive: true, brand: true },
    });

    if (!vehicle) {
      return NextResponse.json({ error: "Vehiculul nu a fost gasit" }, { status: 404 });
    }

    if (!vehicle.availableTestDrive && !adminOverride) {
      return NextResponse.json(
        { error: "Vehiculul nu este disponibil pentru test drive" },
        { status: 400 }
      );
    }

    // Check for conflicts (same vehicle, overlapping time)
    const scheduledDate = new Date(scheduledAt);
    const durationMin = duration ?? 30;
    const endDate = new Date(scheduledDate.getTime() + durationMin * 60 * 1000);

    const conflict = await prisma.testDrive.findFirst({
      where: {
        vehicleId,
        status: { in: ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"] },
        scheduledAt: { lt: endDate },
        AND: {
          scheduledAt: {
            gte: new Date(scheduledDate.getTime() - durationMin * 60 * 1000),
          },
        },
      },
    });

    if (conflict) {
      return NextResponse.json(
        { error: "Exista deja un test drive programat in acest interval" },
        { status: 409 }
      );
    }

    // Block TD if vehicle is on an active demo booking that overlaps this slot.
    // Demo booking takes priority over test drive.
    if (!adminOverride) {
      const demoConflict = await prisma.demoBooking.findFirst({
        where: {
          vehicleId,
          status: { in: ["APPROVED", "PENDING"] },
          startDate: { lt: endDate },
          endDate: { gt: scheduledDate },
        },
        select: { startDate: true, endDate: true },
      });

      if (demoConflict) {
        return NextResponse.json(
          {
            error: "Mașina este rezervată pentru demo în acest interval. Test drive-ul nu poate fi programat.",
          },
          { status: 409 }
        );
      }
    }

    const testDrive = await prisma.testDrive.create({
      data: {
        vehicleId,
        customerId,
        scheduledAt: scheduledDate,
        duration: durationMin,
        agentId: agentId || null,
        notes: notes || null,
        brand: brand || vehicle.brand,
        status: status || "SCHEDULED",
        contactName: contactName || null,
        contactPhone: contactPhone || null,
        contactEmail: contactEmail || null,
      },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        vehicle: {
          select: {
            year: true,
            make: { select: { name: true } },
            model: { select: { name: true } },
          },
        },
      },
    });

    // Mark any conflicting demo bookings and notify
    handleTestDriveConflictWithDemoBookings(
      testDrive.id,
      vehicleId,
      scheduledDate,
      durationMin
    ).catch((e) => console.error("[TD conflict check] error:", e));

    // Sync with Google Calendar if agent has it connected
    if (agentId) {
      (async () => {
        try {
          const endDate = new Date(scheduledDate.getTime() + durationMin * 60 * 1000);
          const eventId = await createGoogleEvent(agentId, {
            summary: `Test drive — ${testDrive.customer.firstName} ${testDrive.customer.lastName}`,
            description: `Vehicul: ${testDrive.vehicle?.make?.name || ""} ${testDrive.vehicle?.model?.name || ""} (${testDrive.vehicle?.year || ""})\n${notes || ""}`,
            start: scheduledDate,
            end: endDate,
            location: "Autoerebus Showroom",
          });
          if (eventId) {
            await prisma.testDrive.update({
              where: { id: testDrive.id },
              data: { googleEventId: eventId },
            });
          }
        } catch (e) {
          console.error("[GoogleCalendar:create] error:", e);
        }
      })();
    }

    return NextResponse.json(testDrive, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Eroare la creare";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
