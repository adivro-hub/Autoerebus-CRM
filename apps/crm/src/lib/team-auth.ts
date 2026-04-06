import { prisma } from "@autoerebus/database";

/**
 * Get the user's team memberships with brand and role info
 */
export async function getUserTeams(userId: string) {
  return prisma.teamMember.findMany({
    where: { userId },
    include: { team: true },
  });
}

/**
 * Get list of brands a user can access (via team membership)
 */
export async function getUserBrands(userId: string, isSuperAdmin: boolean): Promise<string[]> {
  if (isSuperAdmin) {
    return ["NISSAN", "RENAULT", "AUTORULATE", "SERVICE"];
  }
  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    include: { team: { select: { brand: true } } },
  });
  return memberships.map((m) => m.team.brand);
}

/**
 * Check if user is supervisor for a given brand
 */
export async function isSupervisorForBrand(userId: string, brand: string): Promise<boolean> {
  const membership = await prisma.teamMember.findFirst({
    where: {
      userId,
      role: "SUPERVISOR",
      team: { brand: brand as any },
    },
  });
  return !!membership;
}

/**
 * Get the team ID for a specific brand
 */
export async function getTeamIdByBrand(brand: string): Promise<string | null> {
  const team = await prisma.team.findUnique({
    where: { brand: brand as any },
    select: { id: true },
  });
  return team?.id || null;
}

/**
 * Check if user is member (any role) for a given brand
 */
export async function isMemberOfBrand(userId: string, brand: string): Promise<boolean> {
  const membership = await prisma.teamMember.findFirst({
    where: {
      userId,
      team: { brand: brand as any },
    },
  });
  return !!membership;
}
