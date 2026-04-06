import { prisma } from "@autoerebus/database";

/**
 * Check if a time range overlaps with existing demo bookings for a vehicle.
 * Returns the conflicting booking if found.
 */
export async function findConflictingBooking(
  vehicleId: string,
  startDate: Date,
  endDate: Date,
  excludeBookingId?: string
) {
  return prisma.demoBooking.findFirst({
    where: {
      vehicleId,
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
      // Include CONFLICTED too — car is still with the user until returned
      status: { in: ["PENDING", "APPROVED", "CONFLICTED"] },
      // Strict overlap: [startA, endA) overlaps [startB, endB) iff startA < endB AND endA > startB
      startDate: { lt: endDate },
      endDate: { gt: startDate },
    },
    include: {
      vehicle: { select: { title: true } },
      user: { select: { firstName: true, lastName: true } },
      customer: { select: { firstName: true, lastName: true } },
    },
  });
}

/**
 * Check if a time range overlaps with existing test drives for a vehicle.
 * Test drives take priority over demo bookings.
 */
export async function findConflictingTestDrive(
  vehicleId: string,
  startDate: Date,
  endDate: Date
) {
  return prisma.testDrive.findFirst({
    where: {
      vehicleId,
      status: { in: ["SCHEDULED", "CONFIRMED"] },
      scheduledAt: {
        gte: new Date(startDate.getTime() - 60 * 60 * 1000), // 1h buffer before
        lt: endDate,
      },
    },
    include: {
      customer: { select: { firstName: true, lastName: true } },
    },
  });
}

/**
 * Find demo bookings that conflict with a new test drive.
 * Used when a test drive is created to notify affected demo users.
 */
export async function findBookingsConflictingWithTestDrive(
  vehicleId: string,
  testDriveStart: Date,
  testDriveDuration: number = 30
) {
  const testDriveEnd = new Date(testDriveStart.getTime() + testDriveDuration * 60 * 1000);

  return prisma.demoBooking.findMany({
    where: {
      vehicleId,
      status: "APPROVED",
      OR: [
        { startDate: { lte: testDriveStart }, endDate: { gt: testDriveStart } },
        { startDate: { lt: testDriveEnd }, endDate: { gte: testDriveEnd } },
        { startDate: { gte: testDriveStart }, endDate: { lte: testDriveEnd } },
      ],
    },
    include: {
      vehicle: { select: { title: true } },
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
    },
  });
}
