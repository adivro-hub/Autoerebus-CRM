import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@autoerebus/database";
import { auth } from "@/lib/auth";

// Available for both external websites (via API key) and CRM admin (via session)

const API_KEYS: Record<string, string> = {
  [process.env.NISSAN_API_KEY ?? "nissan-autoerebus-key"]: "NISSAN",
  [process.env.RENAULT_API_KEY ?? "renault-autoerebus-key"]: "RENAULT",
  [process.env.AUTORULATE_API_KEY ?? "autorulate-autoerebus-key"]: "AUTORULATE",
};

// Working hours: 09:00 - 18:00, last slot at 17:00 (30 min test drive)
const START_HOUR = 9;
const END_HOUR = 17; // last slot start
const SLOT_DURATION = 30; // minutes
const BUFFER = 30; // minutes between test drives
const TOTAL_BLOCK = SLOT_DURATION + BUFFER; // 60 minutes blocked per test drive

function generateAllSlots(): string[] {
  const slots: string[] = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    if (h < END_HOUR || true) {
      slots.push(`${String(h).padStart(2, "0")}:30`);
    }
  }
  // Remove 17:30 — too late for a 30-min test drive before 18:00
  return slots.filter((s) => s <= "17:00");
}

export async function GET(request: NextRequest) {
  try {
    // Auth: API key (external) or session (CRM admin)
    const apiKey = request.headers.get("x-api-key");
    const brand = apiKey ? API_KEYS[apiKey] : null;
    const session = !brand ? await auth() : null;

    if (!brand && !session?.user) {
      return NextResponse.json(
        { success: false, error: "Invalid API key" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const vehicleId = searchParams.get("vehicleId");
    const externalCarId = searchParams.get("externalCarId");
    const date = searchParams.get("date"); // YYYY-MM-DD

    if (!date) {
      return NextResponse.json(
        { success: false, error: "Missing date parameter" },
        { status: 400 }
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return NextResponse.json(
        { success: false, error: "Invalid date format. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }

    // Check if date is in the past
    const dateObj = new Date(date + "T12:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dateObj < today) {
      return NextResponse.json({
        success: true,
        data: {
          date,
          slots: [],
          message: "Nu puteți programa în trecut.",
        },
      });
    }

    // Find vehicle by CRM vehicleId or externalCarId
    let resolvedVehicleId = vehicleId;

    if (!resolvedVehicleId && externalCarId) {
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          ...(brand && { brand }),
          autovitId: `autorulate:${externalCarId}`,
        },
        select: { id: true },
      });
      resolvedVehicleId = vehicle?.id || null;
    }

    if (!resolvedVehicleId) {
      // If no vehicle found, return all slots as available
      return NextResponse.json({
        success: true,
        data: {
          date,
          slots: generateAllSlots().map((time) => ({ time, available: true })),
        },
      });
    }

    // Get existing test drives for this vehicle on this date (Romania timezone)
    const testDateForTz = new Date(`${date}T12:00:00Z`);
    const roFmt = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Bucharest", timeZoneName: "short" });
    const tzP = roFmt.formatToParts(testDateForTz);
    const tzN = tzP.find((p) => p.type === "timeZoneName")?.value || "";
    const tz = tzN.includes("3") || tzN === "EEST" ? "+03:00" : "+02:00";
    const startOfDay = new Date(`${date}T00:00:00${tz}`);
    const endOfDay = new Date(`${date}T23:59:59${tz}`);

    const existingTDs = await prisma.testDrive.findMany({
      where: {
        vehicleId: resolvedVehicleId,
        status: { in: ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"] },
        scheduledAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: { scheduledAt: true, duration: true },
    });

    // Generate all slots and mark unavailable ones
    const allSlots = generateAllSlots();
    const slots = allSlots.map((time) => {
      const slotStart = new Date(`${date}T${time}:00${tz}`);
      const slotStartMs = slotStart.getTime();

      // Check if this slot conflicts with any existing test drive
      // A slot is unavailable if it's within TOTAL_BLOCK (60 min) of an existing TD
      const isBlocked = existingTDs.some((td: { scheduledAt: Date; duration: number | null }) => {
        const tdStart = new Date(td.scheduledAt).getTime();
        const tdDuration = td.duration || SLOT_DURATION;
        const tdBlock = tdDuration + BUFFER; // total blocked time

        // Blocked if: slot starts during the TD block OR TD starts during this slot's block
        const blockStart = tdStart - (TOTAL_BLOCK - SLOT_DURATION) * 60 * 1000; // 30 min before TD
        const blockEnd = tdStart + tdBlock * 60 * 1000; // 60 min after TD start

        return slotStartMs >= blockStart && slotStartMs < blockEnd;
      });

      // Also check if slot is in the past (for today)
      const now = new Date();
      const isPast = slotStart < now;

      return {
        time,
        available: !isBlocked && !isPast,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        date,
        vehicleId: resolvedVehicleId,
        slots,
      },
    });
  } catch (error) {
    console.error("[API:TestDrive:Slots] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500 }
    );
  }
}
