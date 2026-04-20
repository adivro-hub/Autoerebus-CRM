import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@autoerebus/database";
import { auth } from "@/lib/auth";

// Working hours: 09:00 - 18:00, last slot at 17:00 (60 min appointment)
const START_HOUR = 9;
const END_HOUR = 17;
const SLOT_DURATION = 60; // minutes (1 hour reservation)

function generateAllSlots(): string[] {
  const slots: string[] = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    if (h < END_HOUR) {
      slots.push(`${String(h).padStart(2, "0")}:30`);
    }
  }
  return slots;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const agentId = searchParams.get("agentId");

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { success: false, error: "Invalid date. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }

    const dateObj = new Date(date + "T12:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dateObj < today) {
      return NextResponse.json({
        success: true,
        data: { date, slots: [], message: "Nu puteți programa în trecut." },
      });
    }

    // Romania timezone offset
    const testDateForTz = new Date(`${date}T12:00:00Z`);
    const roFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Bucharest",
      timeZoneName: "short",
    });
    const tzP = roFmt.formatToParts(testDateForTz);
    const tzN = tzP.find((p) => p.type === "timeZoneName")?.value || "";
    const tz = tzN.includes("3") || tzN === "EEST" ? "+03:00" : "+02:00";

    const startOfDay = new Date(`${date}T00:00:00${tz}`);
    const endOfDay = new Date(`${date}T23:59:59${tz}`);

    // Fetch existing showroom appointments that day (optionally filtered by agent)
    const where: Record<string, unknown> = {
      status: { in: ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"] },
      scheduledAt: { gte: startOfDay, lte: endOfDay },
    };
    if (agentId) where.agentId = agentId;

    const existing = await prisma.showroomAppointment.findMany({
      where,
      select: { scheduledAt: true, duration: true },
    });

    // Mark slots as unavailable if they conflict with an existing appointment
    const allSlots = generateAllSlots();
    const slots = allSlots.map((time) => {
      const slotStart = new Date(`${date}T${time}:00${tz}`).getTime();
      const slotEnd = slotStart + SLOT_DURATION * 60000;

      const isBlocked = existing.some((a) => {
        const aStart = new Date(a.scheduledAt).getTime();
        const aEnd = aStart + (a.duration || SLOT_DURATION) * 60000;
        // Overlap check
        return slotStart < aEnd && slotEnd > aStart;
      });

      return { time, available: !isBlocked };
    });

    return NextResponse.json({ success: true, data: { date, slots } });
  } catch (error: unknown) {
    console.error("Showroom slots error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}
