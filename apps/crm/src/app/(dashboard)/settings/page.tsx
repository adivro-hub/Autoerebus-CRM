import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@autoerebus/ui";
import { Bell, Users, Mail, UsersRound } from "lucide-react";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = (session.user as any).role;
  const isSuperAdmin = role === "SUPER_ADMIN";

  const sections = [
    {
      href: "/settings/templates",
      icon: Mail,
      title: "Template-uri notificări",
      description: "Editează mesajele pentru email și SMS",
    },
    ...(isSuperAdmin
      ? [
          {
            href: "/settings/teams",
            icon: UsersRound,
            title: "Echipe",
            description: "Asignează membri și supervizori la echipele per brand",
          },
        ]
      : []),
    {
      href: "/users",
      icon: Users,
      title: "Utilizatori",
      description: "Gestionează adminii CRM",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-base font-semibold">Setări</h1>
        <p className="text-sm text-gray-500">Configurare sistem CRM</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.href} href={s.href}>
              <Card className="h-full transition hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-base">{s.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500">{s.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
