import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@autoerebus/database";
import TeamsClient from "./teams-client";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = (session.user as any).role;
  if (role !== "SUPER_ADMIN") redirect("/dashboard");

  const teams = await prisma.team.findMany({
    include: {
      members: {
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, active: true },
          },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
    orderBy: { brand: "asc" },
  });

  const allUsers = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, firstName: true, lastName: true, email: true },
    orderBy: { firstName: "asc" },
  });

  return <TeamsClient initialTeams={teams} allUsers={allUsers} />;
}
