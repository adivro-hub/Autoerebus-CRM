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

interface PageProps {
  searchParams: Promise<{ brand?: string; search?: string; type?: string; page?: string }>;
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
    city: string | null;
    county: string | null;
    createdAt: Date;
    _count: { leads: number; serviceOrders: number };
  }> = [];
  let total = 0;

  try {
    const where: Record<string, unknown> = {};
    if (params.brand && params.brand !== "ALL") {
      where.leads = { some: { brand: params.brand } };
    }
    if (params.type) where.type = params.type;
    if (params.search) {
      where.OR = [
        { firstName: { contains: params.search, mode: "insensitive" } },
        { lastName: { contains: params.search, mode: "insensitive" } },
        { email: { contains: params.search, mode: "insensitive" } },
        { phone: { contains: params.search, mode: "insensitive" } },
        { company: { contains: params.search, mode: "insensitive" } },
      ];
    }

    [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          _count: {
            select: { leads: true, serviceOrders: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }) as typeof customers & Promise<typeof customers>,
      prisma.customer.count({ where }),
    ]);
  } catch {
    // DB not available
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Clienti
          </h1>
          <p className="text-sm text-muted-foreground">
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
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cauta clienti..."
            defaultValue={params.search ?? ""}
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-4 text-sm placeholder:text-muted-foreground"
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
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
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
                    <th className="px-4 py-3 text-left font-medium">Locatie</th>
                    <th className="px-4 py-3 text-left font-medium">Lead-uri</th>
                    <th className="px-4 py-3 text-left font-medium">Service</th>
                    <th className="px-4 py-3 text-left font-medium">Data Inregistrarii</th>
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
                            <p className="text-xs text-muted-foreground">
                              {customer.company}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          {customer.email && (
                            <p className="text-xs">{customer.email}</p>
                          )}
                          {customer.phone && (
                            <p className="text-xs text-muted-foreground">
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
                      <td className="px-4 py-3 text-muted-foreground">
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
                      <td className="px-4 py-3 text-muted-foreground">
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
              <p className="text-sm text-muted-foreground">
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
