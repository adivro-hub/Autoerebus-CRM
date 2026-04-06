"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@autoerebus/ui/components/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { MakeForm } from "./makes-form";
import { deleteMake } from "./actions";

interface MakeData {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  order: number;
  _count: { models: number; vehicles: number };
}

interface MakesClientProps {
  makes: MakeData[];
}

export function MakesClient({ makes }: MakesClientProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingMake, setEditingMake] = useState<MakeData | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");

  function handleEdit(make: MakeData) {
    setEditingMake(make);
    setFormOpen(true);
  }

  function handleAdd() {
    setEditingMake(null);
    setFormOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Sigur doriti sa stergeti aceasta marca?")) return;

    setDeleting(id);
    setError("");
    const result = await deleteMake(id);
    setDeleting(null);

    if (result.error) {
      setError(result.error);
    }
  }

  return (
    <>
      <div className="flex items-center justify-end border-b px-4 py-3">
        <Button onClick={handleAdd} size="sm">
          <Plus className="h-4 w-4" />
          Adauga Marca
        </Button>
      </div>

      {error && (
        <div className="mx-4 mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {makes.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Ordine</th>
                <th className="px-4 py-3 text-left font-medium">Marca</th>
                <th className="px-4 py-3 text-left font-medium">Slug</th>
                <th className="px-4 py-3 text-left font-medium">Logo</th>
                <th className="px-4 py-3 text-left font-medium">Modele</th>
                <th className="px-4 py-3 text-left font-medium">Vehicule</th>
                <th className="px-4 py-3 text-right font-medium">Actiuni</th>
              </tr>
            </thead>
            <tbody>
              {makes.map((make) => (
                <tr
                  key={make.id}
                  className="border-b transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3 text-gray-500">
                    {make.order}
                  </td>
                  <td className="px-4 py-3 font-medium">{make.name}</td>
                  <td className="px-4 py-3 font-mono text-sm text-gray-500">
                    {make.slug}
                  </td>
                  <td className="px-4 py-3">
                    {make.logo ? (
                      <Image
                        src={make.logo}
                        alt={make.name}
                        width={24}
                        height={24}
                        className="h-6 w-6 object-contain"
                      />
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{make._count.models}</td>
                  <td className="px-4 py-3">{make._count.vehicles}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(make)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(make.id)}
                        disabled={deleting === make.id}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <MakeForm
        open={formOpen}
        onOpenChange={setFormOpen}
        make={editingMake}
      />
    </>
  );
}
