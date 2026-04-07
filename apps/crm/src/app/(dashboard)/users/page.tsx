export const dynamic = "force-dynamic";

import { prisma } from "@autoerebus/database";
import UsersClient from "./users-client";

export const metadata = {
  title: "Utilizatori",
};

export default async function UsersPage() {
  let users: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    role: string;
    brands: string[];
    permissions: string[];
    active: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
  }> = [];

  try {
    users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        brands: true,
        permissions: true,
        active: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
  } catch {
    // DB not available
  }

  return <UsersClient initialUsers={users} />;
}
