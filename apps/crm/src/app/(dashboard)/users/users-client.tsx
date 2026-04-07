"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@autoerebus/ui/components/card";
import { Badge } from "@autoerebus/ui/components/badge";
import { Button } from "@autoerebus/ui/components/button";
import { Input } from "@autoerebus/ui";
import { formatDateTime } from "@autoerebus/ui/lib/utils";
import { Plus, UserCog, Shield, X } from "lucide-react";
import { useToast } from "@/components/toast-provider";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: string;
  brands: string[];
  permissions: string[];
  active: boolean;
  lastLoginAt: Date | string | null;
  createdAt: Date | string;
}

const ROLE_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  SUPER_ADMIN: { label: "Super Admin", variant: "default" },
  ADMIN: { label: "Admin", variant: "default" },
  MANAGER: { label: "Manager", variant: "secondary" },
  AGENT: { label: "Agent", variant: "outline" },
  RECEPTION: { label: "Receptie", variant: "outline" },
};

const BRAND_LABELS: Record<string, string> = {
  NISSAN: "Nissan",
  RENAULT: "Renault",
  AUTORULATE: "Autorulate",
  SERVICE: "Service",
};

const ALL_BRANDS = ["NISSAN", "RENAULT", "AUTORULATE", "SERVICE"];
const ALL_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "AGENT", "RECEPTION"];

interface FormState {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: string;
  brands: string[];
  permissions: string[];
}

const emptyForm: FormState = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  phone: "",
  role: "AGENT",
  brands: [],
  permissions: [],
};

export default function UsersClient({ initialUsers }: { initialUsers: User[] }) {
  const router = useRouter();
  const toast = useToast();
  const [users, setUsers] = useState(initialUsers);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(user: User) {
    setEditingId(user.id);
    setForm({
      email: user.email,
      password: "",
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone || "",
      role: user.role,
      brands: user.brands || [],
      permissions: user.permissions || [],
    });
    setShowForm(true);
  }

  function togglePermission(perm: string) {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter((p) => p !== perm)
        : [...f.permissions, perm],
    }));
  }

  function toggleBrand(brand: string) {
    setForm((f) => ({
      ...f,
      brands: f.brands.includes(brand) ? f.brands.filter((b) => b !== brand) : [...f.brands, brand],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.firstName || !form.lastName || !form.role) {
      toast.warning("Completează toate câmpurile obligatorii");
      return;
    }
    if (!editingId && !form.password) {
      toast.warning("Parola este obligatorie pentru un utilizator nou");
      return;
    }

    setSaving(true);
    try {
      const url = editingId ? `/api/users/${editingId}` : "/api/users";
      const method = editingId ? "PATCH" : "POST";
      const payload: any = {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        role: form.role,
        brands: form.brands,
        permissions: form.permissions,
      };
      if (!editingId) {
        payload.email = form.email;
        payload.password = form.password;
      } else if (form.password) {
        payload.password = form.password;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Nu s-a putut salva utilizatorul", "Eroare");
        return;
      }
      toast.success(editingId ? "Utilizator actualizat" : "Utilizator creat");
      setShowForm(false);
      router.refresh();
    } catch {
      toast.error("Eroare de rețea", "Eroare");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Sigur dezactivezi acest utilizator?")) return;
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Utilizator dezactivat");
      router.refresh();
    } else {
      toast.error("Nu s-a putut dezactiva utilizatorul");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-base font-bold tracking-tight">Utilizatori</h1>
          <p className="text-sm text-gray-500">{users.length} utilizatori înregistrați</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Utilizator Nou
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <UserCog className="mb-3 h-10 w-10" />
              <p className="font-medium">Niciun utilizator găsit</p>
              <p className="text-sm">Adaugă primul utilizator</p>
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
                    <th className="px-4 py-3 text-right font-medium">Acțiuni</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const roleInfo = ROLE_LABELS[user.role] ?? { label: user.role, variant: "outline" as const };
                    return (
                      <tr key={user.id} className="border-b transition-colors hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                              {user.firstName.charAt(0)}
                              {user.lastName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium">{user.firstName} {user.lastName}</p>
                              {user.phone && <p className="text-sm text-gray-500">{user.phone}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{user.email}</td>
                        <td className="px-4 py-3">
                          <Badge variant={roleInfo.variant}>
                            <Shield className="mr-1 h-3 w-3" />
                            {roleInfo.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {user.brands.length === 0 ? (
                              <span className="text-sm text-gray-500">—</span>
                            ) : (
                              user.brands.map((brand) => (
                                <Badge key={brand} variant="secondary" className="text-sm">
                                  {BRAND_LABELS[brand] ?? brand}
                                </Badge>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={user.active ? "default" : "destructive"}>
                            {user.active ? "Activ" : "Inactiv"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {user.lastLoginAt ? formatDateTime(new Date(user.lastLoginAt)) : "Niciodată"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(user)}>
                            Editează
                          </Button>
                          {user.active && (
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(user.id)}>
                              Dezactivează
                            </Button>
                          )}
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

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-lg bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b bg-white px-5 py-3">
              <h2 className="text-base font-semibold text-gray-900">
                {editingId ? "Editează utilizator" : "Utilizator nou"}
              </h2>
              <button onClick={() => setShowForm(false)} className="rounded p-1 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-900">Prenume *</label>
                  <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-900">Nume *</label>
                  <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">Email *</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  disabled={!!editingId}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">
                  {editingId ? "Parolă nouă (lasă gol pentru a păstra)" : "Parolă *"}
                </label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Minim 8 caractere"
                  required={!editingId}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">Telefon</label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">Rol *</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm text-gray-900"
                >
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]?.label || r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">Branduri permise</label>
                <p className="mb-2 text-sm text-gray-500">
                  Userul va vedea date doar pentru aceste branduri. Lasă gol pentru toate (sau pentru Super Admin).
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_BRANDS.map((brand) => (
                    <label
                      key={brand}
                      className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm ${
                        form.brands.includes(brand) ? "border-primary bg-primary/5" : "border-gray-200"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={form.brands.includes(brand)}
                        onChange={() => toggleBrand(brand)}
                      />
                      {BRAND_LABELS[brand]}
                    </label>
                  ))}
                </div>
              </div>

              {/* Permissions - only for AGENT role (others have automatic permissions) */}
              {form.role === "AGENT" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-900">Permisiuni speciale</label>
                  <p className="mb-2 text-sm text-gray-500">
                    Manager și roluri superioare au automat aceste permisiuni.
                  </p>
                  <div className="space-y-2">
                    <label
                      className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm ${
                        form.permissions.includes("TEST_DRIVE_APPROVE") ? "border-primary bg-primary/5" : "border-gray-200"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={form.permissions.includes("TEST_DRIVE_APPROVE")}
                        onChange={() => togglePermission("TEST_DRIVE_APPROVE")}
                      />
                      Poate aproba test drive-uri
                    </label>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} disabled={saving}>
                  Anulează
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Se salvează..." : editingId ? "Salvează" : "Creează"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
