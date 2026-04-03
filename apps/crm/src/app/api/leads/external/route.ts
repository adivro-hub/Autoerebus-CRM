import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@autoerebus/database";

// Public endpoint - no auth required, uses API key
// Accepts leads/inquiries from external websites (Nissan, Renault, Autorulate)

const API_KEYS: Record<string, string> = {
  [process.env.NISSAN_API_KEY ?? "nissan-autoerebus-key"]: "NISSAN",
  [process.env.RENAULT_API_KEY ?? "renault-autoerebus-key"]: "RENAULT",
  [process.env.AUTORULATE_API_KEY ?? "autorulate-autoerebus-key"]: "AUTORULATE",
};

const SOURCE_MAP: Record<string, string> = {
  NISSAN: "WEBSITE_NISSAN",
  RENAULT: "WEBSITE_RENAULT",
  AUTORULATE: "WEBSITE_AUTORULATE",
};

const TYPE_LABELS: Record<string, string> = {
  GENERAL: "Întrebare generală",
  CAR_INQUIRY: "Cerere despre mașină",
  SELL: "Vinde mașina",
  TRADE_IN: "Trade-In",
  PRICE_OFFER: "Cerere ofertă preț",
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
      name, // some forms send "name" instead of firstName/lastName
      email,
      phone,
      message,
      type, // GENERAL, CAR_INQUIRY, SELL, TRADE_IN, PRICE_OFFER
      carTitle, // title of the car if inquiry is about a specific car
      externalCarId, // autorulate car ID
      vehicleMake, // for sell/trade-in
      vehicleModel,
      vehicleYear,
      vehicleMileage,
      subject,
      utm, // UTM tracking data { utm_source, utm_medium, utm_campaign, gclid, fbclid }
    } = body;

    // Parse name into first/last if needed
    let fName = firstName;
    let lName = lastName;
    if (!fName && name) {
      const parts = name.trim().split(/\s+/);
      fName = parts[0] || "Necunoscut";
      lName = parts.slice(1).join(" ") || "";
    }

    if (!fName || (!phone && !email)) {
      return NextResponse.json(
        { success: false, error: "Missing required fields (name + phone or email)" },
        { status: 400 }
      );
    }

    // Find or create customer
    let customer = null;

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
          firstName: fName,
          lastName: lName || "",
          email: email?.toLowerCase() || null,
          phone: phone || null,
          source: SOURCE_MAP[brand] || "OTHER",
          type: "INDIVIDUAL",
        },
      });
    }

    // Try to find associated vehicle
    let vehicleId: string | null = null;

    if (externalCarId) {
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          brand: brand as "NISSAN" | "RENAULT" | "AUTORULATE" | "SERVICE",
          autovitId: `autorulate:${externalCarId}`,
        },
        select: { id: true },
      });
      if (vehicle) vehicleId = vehicle.id;
    }

    if (!vehicleId && carTitle) {
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          brand: brand as "NISSAN" | "RENAULT" | "AUTORULATE" | "SERVICE",
          OR: [
            { title: { equals: carTitle, mode: "insensitive" } },
            { title: { contains: carTitle, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });
      if (vehicle) vehicleId = vehicle.id;
    }

    // Determine lead source from UTM data or default to website brand
    let leadSource = SOURCE_MAP[brand] || "OTHER";
    if (utm) {
      if (utm.gclid || utm.utm_source === "google") leadSource = "GOOGLE_ADS";
      else if (utm.fbclid || utm.utm_source === "facebook" || utm.utm_source === "fb" || utm.utm_source === "instagram" || utm.utm_source === "ig") leadSource = "FACEBOOK";
      else if (utm.utm_source === "autovit") leadSource = "AUTOVIT";
    }

    // Build notes from all available info
    const notesParts: string[] = [];
    notesParts.push(`[${brand}] ${TYPE_LABELS[type] || type || "Cerere"}`);
    if (subject) notesParts.push(`Subiect: ${subject}`);
    if (carTitle) notesParts.push(`Mașină: ${carTitle}`);
    if (vehicleMake) notesParts.push(`Vehicul client: ${vehicleMake} ${vehicleModel || ""} ${vehicleYear || ""} ${vehicleMileage ? `(${vehicleMileage} km)` : ""}`);
    if (message) notesParts.push(`Mesaj: ${message}`);
    if (utm) {
      const utmParts: string[] = [];
      if (utm.utm_source) utmParts.push(`source: ${utm.utm_source}`);
      if (utm.utm_medium) utmParts.push(`medium: ${utm.utm_medium}`);
      if (utm.utm_campaign) utmParts.push(`campaign: ${utm.utm_campaign}`);
      if (utm.gclid) utmParts.push(`gclid: ${utm.gclid.slice(0, 12)}...`);
      if (utmParts.length > 0) notesParts.push(`📊 Tracking: ${utmParts.join(", ")}`);
    }

    // Create lead
    const lead = await prisma.lead.create({
      data: {
        customerId: customer.id,
        vehicleId,
        source: leadSource as "WEBSITE_NISSAN" | "WEBSITE_RENAULT" | "WEBSITE_AUTORULATE" | "GOOGLE_ADS" | "FACEBOOK" | "AUTOVIT" | "OTHER",
        type: type === "PRICE_OFFER" ? "PRICE_OFFER" : type === "TEST_DRIVE" ? "TEST_DRIVE" : type === "CALLBACK" ? "CALLBACK" : type === "TRADE_IN" ? "CAR_INQUIRY" : "CAR_INQUIRY",
        brand: brand as "NISSAN" | "RENAULT" | "AUTORULATE" | "SERVICE",
        status: "NEW",
        priority: type === "CAR_INQUIRY" || type === "PRICE_OFFER" ? 1 : 0,
        notes: notesParts.join("\n"),
      },
    });

    // Auto-create deal in "Lead Nou" pipeline stage for this brand
    const leadNouStage = await prisma.pipelineStage.findFirst({
      where: {
        pipelineType: "SALES",
        brand: brand as "NISSAN" | "RENAULT" | "AUTORULATE" | "SERVICE",
        order: 0, // "Lead Nou" is always order 0
      },
    });

    if (leadNouStage) {
      const vehicle = vehicleId
        ? await prisma.vehicle.findUnique({
            where: { id: vehicleId },
            select: { price: true, discountPrice: true },
          })
        : null;

      await prisma.deal.create({
        data: {
          leadId: lead.id,
          stageId: leadNouStage.id,
          value: vehicle?.discountPrice ?? vehicle?.price ?? null,
          currency: "EUR",
          probability: 5,
          brand: brand as "NISSAN" | "RENAULT" | "AUTORULATE" | "SERVICE",
        },
      });
    }

    // Create activity for lead creation
    await prisma.activity.create({
      data: {
        type: "CREATED",
        content: `Lead creat automat via website ${brand}. ${TYPE_LABELS[type] || type || "Cerere"}${carTitle ? ` — ${carTitle}` : ""}`,
        leadId: lead.id,
      },
    }).catch(() => {});

    // Log activity
    await prisma.auditLog.create({
      data: {
        action: "LEAD_WEBSITE",
        entity: "Lead",
        entityId: lead.id,
        details: `Lead nou via website ${brand}: ${fName} ${lName} - ${TYPE_LABELS[type] || type || "Cerere"}${carTitle ? ` - ${carTitle}` : ""}`,
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        id: lead.id,
        customerId: customer.id,
        vehicleId,
      },
    });
  } catch (error: unknown) {
    console.error("[API:Leads:External] Error:", error);
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
