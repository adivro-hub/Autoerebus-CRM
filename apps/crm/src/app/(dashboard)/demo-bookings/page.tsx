import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@autoerebus/database";
import { getUserBrands } from "@/lib/team-auth";
import DemoBookingsClient from "./demo-bookings-client";

export const dynamic = "force-dynamic";

export default async function DemoBookingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = session.user.id;
  const isSuperAdmin = (session.user as any).role === "SUPER_ADMIN";
  const userBrands = await getUserBrands(userId, isSuperAdmin);

  // Check if user is supervisor in any team
  const supervisedTeams = await prisma.teamMember.findMany({
    where: { userId, role: "SUPERVISOR" },
    include: { team: true },
  });
  const isSupervisor = supervisedTeams.length > 0 || isSuperAdmin;

  // Fetch team members for recipient picker (users in same teams)
  const teamMemberships = await prisma.teamMember.findMany({
    where: { userId },
    select: { teamId: true },
  });
  const teamIds = teamMemberships.map((m) => m.teamId);

  const teamMembers = isSuperAdmin
    ? await prisma.user.findMany({
        where: { active: true },
        select: { id: true, firstName: true, lastName: true, email: true },
        orderBy: { firstName: "asc" },
      })
    : await prisma.user.findMany({
        where: {
          active: true,
          teams: { some: { teamId: { in: teamIds } } },
        },
        select: { id: true, firstName: true, lastName: true, email: true },
        orderBy: { firstName: "asc" },
      });

  return (
    <DemoBookingsClient
      currentUserId={userId}
      isSuperAdmin={isSuperAdmin}
      isSupervisor={isSupervisor}
      userBrands={userBrands}
      teamMembers={teamMembers}
    />
  );
}
