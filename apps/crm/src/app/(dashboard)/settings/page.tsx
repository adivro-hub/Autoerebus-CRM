import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@autoerebus/database";
import { Card, CardContent, CardHeader, CardTitle } from "@autoerebus/ui";
import { Users, Mail, UsersRound, Calendar as CalendarIcon } from "lucide-react";
import GoogleConnectButton from "./google-connect-button";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ google_connected?: string; google_error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = (session.user as any).role;
  const isSuperAdmin = role === "SUPER_ADMIN";

  const params = await searchParams;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { googleEmail: true, googleRefreshToken: true },
  });
  const googleConnected = !!user?.googleRefreshToken;

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

      {params.google_connected && (
        <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-gray-900">
          Google Calendar conectat cu succes.
        </div>
      )}
      {params.google_error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-gray-900">
          Eroare la conectarea Google Calendar: {params.google_error}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-base">Google Calendar</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-500">
            Sincronizează automat test drive-urile tale cu Google Calendar.
          </p>
          {googleConnected ? (
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <div className="text-gray-900">Conectat: {user?.googleEmail}</div>
              </div>
              <GoogleConnectButton connected />
            </div>
          ) : (
            <GoogleConnectButton connected={false} />
          )}
        </CardContent>
      </Card>

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
