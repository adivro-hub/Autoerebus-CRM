import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@autoerebus/database";

// POST - receive service booking from external site
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  const expectedKey = process.env.SERVICE_API_KEY;

  if (!expectedKey || apiKey !== expectedKey) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      phone,
      email,
      vin,
      make,
      model,
      year,
      fuelType,
      services,
      notes,
      date,
      timeSlot,
      utm, // { utm_source, utm_medium, utm_campaign, gclid, fbclid, referrer, landing_path }
    } = body;

    if (!name || (!phone && !email)) {
      return NextResponse.json(
        { error: "Nume și telefon/email sunt obligatorii" },
        { status: 400 }
      );
    }

    // Parse name
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0] || "Client";
    const lastName = nameParts.slice(1).join(" ") || "Service";

    // Find or create customer
    let customer = null;
    if (phone) {
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
          source: "WEBSITE_SERVICE",
          type: "INDIVIDUAL",
        },
      });
    }

    // Try to match vehicle by VIN
    let vehicleId: string | null = null;
    if (vin) {
      const vehicle = await prisma.vehicle.findFirst({ where: { vin } });
      if (vehicle) vehicleId = vehicle.id;
    }

    // Build service type from services array
    const serviceType = Array.isArray(services) ? services.join(", ") : services || null;

    // Build scheduled date from date + timeSlot
    let scheduledDate: Date | null = null;
    if (date) {
      const dateStr = timeSlot ? `${date}T${timeSlot}:00` : `${date}T09:00:00`;
      scheduledDate = new Date(dateStr);
    }

    // Generate order number
    const count = await prisma.serviceOrder.count();
    const orderNumber = `SRV-${String(count + 1).padStart(5, "0")}`;

    // Build description from vehicle info
    const vehicleDesc = make && model
      ? `${make} ${model}${year ? ` (${year})` : ""}${fuelType ? ` — ${fuelType}` : ""}${vin ? ` — VIN: ${vin}` : ""}`
      : vin ? `VIN: ${vin}` : null;

    // Append UTM attribution to the description so it's visible in
     // the dashboard next to the service order.
    const utmSummary = utm && typeof utm === "object"
      ? (() => {
          const parts: string[] = [];
          if (utm.utm_source) parts.push(`source: ${utm.utm_source}`);
          if (utm.utm_medium) parts.push(`medium: ${utm.utm_medium}`);
          if (utm.utm_campaign) parts.push(`campaign: ${utm.utm_campaign}`);
          if (utm.gclid) parts.push("Google Ads");
          if (utm.fbclid) parts.push("Facebook Ads");
          if (!parts.length && utm.referrer) parts.push(`ref: ${utm.referrer}`);
          return parts.length ? `📊 Tracking: ${parts.join(", ")}` : "";
        })()
      : "";

    const description = [vehicleDesc, notes, utmSummary].filter(Boolean).join("\n");

    const order = await prisma.serviceOrder.create({
      data: {
        orderNumber,
        customerId: customer.id,
        vehicleId,
        type: serviceType,
        description: description || null,
        scheduledDate,
        status: "SCHEDULED",
        brand: "SERVICE",
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        type: "CREATED",
        content: `Programare online — ${serviceType || "General"}`,
        serviceOrderId: order.id,
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      data: { id: order.id, orderNumber: order.orderNumber },
    });
  } catch (error: unknown) {
    console.error("External service booking error:", error);
    return NextResponse.json({ error: "Eroare la creare programare" }, { status: 500 });
  }
}
