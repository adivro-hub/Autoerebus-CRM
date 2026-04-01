import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@autoerebus/database";

// Public endpoint - no auth required
// Accepts test drive requests from external websites (Nissan, Renault, etc.)

const API_KEYS: Record<string, string> = {
  [process.env.NISSAN_API_KEY ?? "nissan-autoerebus-key"]: "NISSAN",
  [process.env.RENAULT_API_KEY ?? "renault-autoerebus-key"]: "RENAULT",
  [process.env.AUTORULATE_API_KEY ?? "autorulate-autoerebus-key"]: "AUTORULATE",
};

export async function POST(request: NextRequest) {
  try {
    // Validate API key
    const apiKey = request.headers.get("x-api-key");
    const brand = apiKey ? API_KEYS[apiKey] : null;

    if (!brand) {
      return NextResponse.json(
        { success: false, error: "Invalid API key" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      model,
      preferredDate,
      preferredTime,
      message,
    } = body;

    if (!firstName || !lastName || !phone || !model || !preferredDate || !preferredTime) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Find or create customer
    let customer = null;

    // Try to find by email first, then by phone
    if (email) {
      customer = await prisma.customer.findFirst({
        where: { email: email.toLowerCase() },
      });
    }
    if (!customer && phone) {
      customer = await prisma.customer.findFirst({
        where: { phone },
      });
    }

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          firstName,
          lastName,
          email: email?.toLowerCase() || null,
          phone,
          source: `WEBSITE_${brand}`,
          type: "INDIVIDUAL",
        },
      });
    }

    // Find the vehicle by model name and brand
    // Try to match a test-drive-available vehicle
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        brand,
        availableTestDrive: true,
        model: {
          name: { contains: model, mode: "insensitive" },
        },
      },
      select: { id: true, brand: true },
    });

    if (!vehicle) {
      // Still create the test drive request, but log that no vehicle matched
      // Create without vehicleId — we'll need to handle this in CRM UI
      return NextResponse.json({
        success: true,
        data: {
          id: `pending_${Date.now()}`,
          note: `No matching vehicle found for model "${model}" in ${brand}. Customer created.`,
          customerId: customer.id,
        },
      });
    }

    // Parse scheduled date/time
    const scheduledAt = new Date(`${preferredDate}T${preferredTime}:00`);

    // Check for conflicts
    const conflict = await prisma.testDrive.findFirst({
      where: {
        vehicleId: vehicle.id,
        status: { in: ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"] },
        scheduledAt: {
          gte: new Date(scheduledAt.getTime() - 30 * 60 * 1000),
          lt: new Date(scheduledAt.getTime() + 30 * 60 * 1000),
        },
      },
    });

    if (conflict) {
      return NextResponse.json(
        {
          success: false,
          error: "Time slot unavailable. Please choose another time.",
          customerId: customer.id,
        },
        { status: 409 }
      );
    }

    // Create the test drive
    const testDrive = await prisma.testDrive.create({
      data: {
        vehicleId: vehicle.id,
        customerId: customer.id,
        scheduledAt,
        duration: 30,
        notes: message
          ? `[Website ${brand}] ${message}`
          : `[Website ${brand}] Model solicitat: ${model}`,
        brand,
        status: "SCHEDULED",
      },
    });

    // Log activity
    await prisma.auditLog.create({
      data: {
        action: "TEST_DRIVE_WEBSITE",
        entity: "TestDrive",
        entityId: testDrive.id,
        details: `Test drive programat via website ${brand}: ${firstName} ${lastName} - ${model}`,
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        id: testDrive.id,
        scheduledAt: testDrive.scheduledAt,
        customerId: customer.id,
      },
    });
  } catch (error: unknown) {
    console.error("[API:TestDrive:External] Error:", error);
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
