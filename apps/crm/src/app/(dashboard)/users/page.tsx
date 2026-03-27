export const dynamic = "force-dynamic";

import { prisma } from "@autoerebus/database";
import { Card, CardContent } from "@autoerebus/ui/components/card";
import { Badge } from "@autoerebus/ui/components/badge";
import { Button } from "@autoerebus/ui/components/button";
import { formatDateTime } from "@autoerebus/ui/lib/utils";
import { BRAND_LABELS } from "@autoerebus/types";
import { Plus, UserCog, Shield } from "lucide-react";

export const metadata = {
  title: "Utilizatori",
};

const ROLE_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  SUPER_ADMIN: { label: "Super Admin", variant: "default" },
  ADMIN: { label: "Admin", variant: "default" },
  MANAGER: { label: "Manager", variant: "secondary" },
  AGENT: { label: "Agent", variant: "outline" },
  RECEPTION: { label: "Receptie", variant: "outline" },
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
        active: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
  } catch {
    // DB not available
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Utilizatori
          </h1>
          <p className="text-sm text-muted-foreground">
            {users.length} utilizatori inregistrati
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          Utilizator Nou
        </Button>
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          {users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <UserCog className="mb-3 h-10 w-10" />
              <p className="font-medium">Niciun utilizator gasit</p>
              <p className="text-sm">Adaugati primul utilizator</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Utilizator</th>
                    <th className="px-4 py-3 text-left font-medium">Email</th>
                    <th className="px-4 py-3 text-left font-medium">Rol</th>
                    <th className="px-4 py-3 text-left font-medium">Branduri</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Ultima Conectare</th>
                    <th className="px-4 py-3 text-right font-medium">Actiuni</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const roleInfo = ROLE_LABELS[user.role] ?? {
                      label: user.role,
                      variant: "outline" as const,
                    };

                    return (
                      <tr
                        key={user.id}
                        className="border-b transition-colors hover:bg-muted/30"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                              {user.firstName.charAt(0)}
                              {user.lastName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium">
                                {user.firstName} {user.lastName}
                              </p>
                              {user.phone && (
                                <p className="text-xs text-muted-foreground">
                                  {user.phone}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {user.email}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={roleInfo.variant}>
                            <Shield className="mr-1 h-3 w-3" />
                            {roleInfo.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {user.brands.map((brand) => (
                              <Badge
                                key={brand}
                                variant="secondary"
                                className="text-[10px]"
                              >
                                {BRAND_LABELS[brand as keyof typeof BRAND_LABELS] ?? brand}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={user.active ? "default" : "destructive"}>
                            {user.active ? "Activ" : "Inactiv"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {user.lastLoginAt
                            ? formatDateTime(user.lastLoginAt)
                            : "Niciodata"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm">
                            Editeaza
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
