import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";

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

    const { vehicleId, customerId, scheduledAt, duration, agentId, notes, brand } = body;

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

    if (!vehicle.availableTestDrive) {
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

    const testDrive = await prisma.testDrive.create({
      data: {
        vehicleId,
        customerId,
        scheduledAt: scheduledDate,
        duration: durationMin,
        agentId: agentId || null,
        notes: notes || null,
        brand: brand || vehicle.brand,
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

    return NextResponse.json(testDrive, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Eroare la creare";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
