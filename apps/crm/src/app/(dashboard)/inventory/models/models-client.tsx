"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@autoerebus/ui/components/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { ModelForm } from "./models-form";
import { deleteModel } from "./actions";

interface MakeOption {
  id: string;
  name: string;
}

interface ModelData {
  id: string;
  name: string;
  slug: string;
  makeId: string;
  make: { name: string };
  _count: { vehicles: number };
}

interface ModelsClientProps {
  models: ModelData[];
  makes: MakeOption[];
  currentMakeId: string;
}

export function ModelsClient({
  models,
  makes,
  currentMakeId,
}: ModelsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelData | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");

  function handleEdit(model: ModelData) {
    setEditingModel(model);
    setFormOpen(true);
  }

  function handleAdd() {
    setEditingModel(null);
    setFormOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Sigur doriti sa stergeti acest model?")) return;

    setDeleting(id);
    setError("");
    const result = await deleteModel(id);
    setDeleting(null);

    if (result.error) {
      setError(result.error);
    }
  }

  function handleMakeFilter(makeId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (makeId) {
      params.set("make", makeId);
    } else {
      params.delete("make");
    }
    router.push(`/inventory/models?${params.toString()}`);
  }

  return (
    <>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <select
          value={currentMakeId}
          onChange={(e) => handleMakeFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Toate marcile</option>
          {makes.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        <Button onClick={handleAdd} size="sm">
          <Plus className="h-4 w-4" />
          Adauga Model
        </Button>
      </div>

      {error && (
        <div className="mx-4 mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {models.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Marca</th>
                <th className="px-4 py-3 text-left font-medium">Model</th>
                <th className="px-4 py-3 text-left font-medium">Slug</th>
                <th className="px-4 py-3 text-left font-medium">Vehicule</th>
                <th className="px-4 py-3 text-right font-medium">Actiuni</th>
              </tr>
            </thead>
            <tbody>
              {models.map((model) => (
                <tr
                  key={model.id}
                  className="border-b transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3">{model.make.name}</td>
                  <td className="px-4 py-3 font-medium">{model.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {model.slug}
                  </td>
                  <td className="px-4 py-3">{model._count.vehicles}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(model)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(model.id)}
                        disabled={deleting === model.id}
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

      <ModelForm
        open={formOpen}
        onOpenChange={setFormOpen}
        model={editingModel}
        makes={makes}
      />
    </>
  );
}
