export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@autoerebus/database";
import { Card, CardContent } from "@autoerebus/ui/components/card";
import { Badge } from "@autoerebus/ui/components/badge";
import { Button } from "@autoerebus/ui/components/button";
import { formatDate } from "@autoerebus/ui/lib/utils";
import { Plus, Users, Search } from "lucide-react";

export const metadata = {
  title: "Clienti",
};

const TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL: "Persoana Fizica",
  COMPANY: "Companie",
};

const SOURCE_LABELS: Record<string, string> = {
  WEBSITE_NISSAN: "Website Nissan",
  WEBSITE_RENAULT: "Website Renault",
  WEBSITE_AUTORULATE: "Website Autorulate",
  WEBSITE_SERVICE: "Website Service",
  PHONE: "Telefon",
  WALK_IN: "Walk-in",
  REFERRAL: "Recomandare",
  AUTOVIT: "Autovit",
  FACEBOOK: "Facebook",
  GOOGLE_ADS: "Google Ads",
  OTHER: "Altele",
};

interface PageProps {
  searchParams: Promise<{ brand?: string; search?: string; type?: string; source?: string; page?: string }>;
}

export default async function CustomersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);
  const pageSize = 25;

  let customers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    company: string | null;
    type: string;
    source: string | null;
    sourceDetail: string | null;
    city: string | null;
    county: string | null;
    createdAt: Date;
    createdBy: { firstName: string; lastName: string } | null;
    _count: { leads: number; serviceOrders: number };
  }> = [];
  let total = 0;

  try {
    const where: Record<string, unknown> = {};
    if (params.brand && params.brand !== "ALL") {
      where.leads = { some: { brand: params.brand } };
    }
    if (params.type) where.type = params.type;
    if (params.source) where.source = params.source;
    if (params.search) {
      where.OR = [
        { firstName: { contains: params.search, mode: "insensitive" } },
        { lastName: { contains: params.search, mode: "insensitive" } },
        { email: { contains: params.search, mode: "insensitive" } },
        { phone: { contains: params.search, mode: "insensitive" } },
        { company: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const [customersResult, totalResult] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          createdBy: { select: { firstName: true, lastName: true } },
          _count: {
            select: { leads: true, serviceOrders: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.customer.count({ where }),
    ]);
    customers = customersResult as typeof customers;
    total = totalResult;
  } catch {
    // DB not available
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-base font-bold tracking-tight">
            Clienti
          </h1>
          <p className="text-sm text-gray-500">
            {total} clienti in baza de date
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          Client Nou
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Cauta clienti..."
            defaultValue={params.search ?? ""}
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-4 text-sm placeholder:text-gray-500"
          />
        </div>
        <select
          defaultValue={params.type ?? ""}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Toti clientii</option>
          <option value="INDIVIDUAL">Persoane Fizice</option>
          <option value="COMPANY">Companii</option>
        </select>
        <select
          defaultValue={params.source ?? ""}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Toate sursele</option>
          {Object.entries(SOURCE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Users className="mb-3 h-10 w-10" />
              <p className="font-medium">Niciun client gasit</p>
              <p className="text-sm">Adaugati un client nou sau ajustati cautarea</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Nume</th>
                    <th className="px-4 py-3 text-left font-medium">Contact</th>
                    <th className="px-4 py-3 text-left font-medium">Tip</th>
                    <th className="px-4 py-3 text-left font-medium">Sursa</th>
                    <th className="px-4 py-3 text-left font-medium">Locatie</th>
                    <th className="px-4 py-3 text-left font-medium">Lead-uri</th>
                    <th className="px-4 py-3 text-left font-medium">Service</th>
                    <th className="px-4 py-3 text-left font-medium">Adaugat de</th>
                    <th className="px-4 py-3 text-left font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="border-b transition-colors hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">
                            {customer.firstName} {customer.lastName}
                          </p>
                          {customer.company && (
                            <p className="text-sm text-gray-500">
                              {customer.company}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          {customer.email && (
                            <p className="text-sm">{customer.email}</p>
                          )}
                          {customer.phone && (
                            <p className="text-sm text-gray-500">
                              {customer.phone}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">
                          {TYPE_LABELS[customer.type] ?? customer.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {customer.source ? (
                          <div>
                            <Badge variant="secondary" className="text-sm">
                              {SOURCE_LABELS[customer.source] ?? customer.source}
                            </Badge>
                            {customer.sourceDetail && (
                              <p className="mt-0.5 text-sm text-gray-500">
                                {customer.sourceDetail}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {[customer.city, customer.county]
                          .filter(Boolean)
                          .join(", ") || "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {customer._count.leads}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {customer._count.serviceOrders}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm">
                        {customer.createdBy
                          ? `${customer.createdBy.firstName} ${customer.createdBy.lastName}`
                          : (<span className="italic">Sistem</span>)}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatDate(customer.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-gray-500">
                Pagina {page} din {totalPages}
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={`/customers?page=${page - 1}`}>
                    <Button variant="outline" size="sm">Inapoi</Button>
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={`/customers?page=${page + 1}`}>
                    <Button variant="outline" size="sm">Inainte</Button>
                  </Link>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
