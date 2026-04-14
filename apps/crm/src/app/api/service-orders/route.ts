import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@autoerebus/database";

// GET - list service orders
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search") || "";
  const agent = searchParams.get("agent");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (agent) where.assignedToId = agent;
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: "insensitive" } },
      { type: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { customer: { firstName: { contains: search, mode: "insensitive" } } },
      { customer: { lastName: { contains: search, mode: "insensitive" } } },
      { customer: { phone: { contains: search } } },
    ];
  }

  try {
    const orders = await prisma.serviceOrder.findMany({
      where,
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, phone: true, email: true },
        },
        vehicle: {
          include: {
            make: { select: { name: true } },
            model: { select: { name: true } },
          },
        },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        activities: {
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: orders });
  } catch (error: unknown) {
    console.error("Service orders list error:", error);
    return NextResponse.json({ error: "Eroare la listare" }, { status: 500 });
  }
}

// POST - create new service order
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const body = await request.json();
  const {
    firstName,
    lastName,
    phone,
    email,
    customerId: existingCustomerId,
    vehicleId,
    type,
    description,
    scheduledDate,
    assignedToId,
    notes,
    estimatedCost,
  } = body;

  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "Nume și prenume sunt obligatorii" },
      { status: 400 }
    );
  }

  try {
    // Find or create customer
    let customer = null;
    if (existingCustomerId) {
      customer = await prisma.customer.findUnique({ where: { id: existingCustomerId } });
    }
    if (!customer && phone) {
      customer = await prisma.customer.findFirst({ where: { phone } });
    }
    if (!customer && email) {
      customer = await prisma.customer.findFirst({
        where: { email: email.toLowerCase() },
      });
    }
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          firstName,
          lastName,
          phone: phone || null,
          email: email?.toLowerCase() || null,
          source: "WALK_IN",
          type: "INDIVIDUAL",
          createdById: session.user.id || null,
        },
      });
    }

    // Generate order number
    const count = await prisma.serviceOrder.count();
    const orderNumber = `SRV-${String(count + 1).padStart(5, "0")}`;

    // Create service order
    const order = await prisma.serviceOrder.create({
      data: {
        orderNumber,
        customerId: customer.id,
        vehicleId: vehicleId || null,
        type: type || null,
        description: description || null,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        assignedToId: assignedToId || session.user.id || null,
        notes: notes || null,
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : null,
        status: "SCHEDULED",
        brand: "SERVICE",
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        type: "CREATED",
        content: `Comandă service creată de ${session.user.name || "admin"} — ${type || "General"}`,
        serviceOrderId: order.id,
        userId: session.user.id || null,
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, data: order });
  } catch (error: unknown) {
    console.error("Service order create error:", error);
    return NextResponse.json({ error: "Eroare la creare" }, { status: 500 });
  }
}
