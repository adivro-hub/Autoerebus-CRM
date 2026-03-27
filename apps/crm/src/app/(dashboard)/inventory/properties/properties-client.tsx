"use client";

import { useState } from "react";
import { Button } from "@autoerebus/ui/components/button";
import { Badge } from "@autoerebus/ui/components/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@autoerebus/ui/components/card";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { PropertyForm } from "./properties-form";
import { deleteProperty, togglePropertyActive } from "./actions";
import { CATEGORY_LABELS } from "./category-labels";

interface PropertyData {
  id: string;
  category: string;
  value: string;
  label: string;
  order: number;
  active: boolean;
}

interface PropertiesClientProps {
  grouped: Record<string, PropertyData[]>;
}

export function PropertiesClient({ grouped }: PropertiesClientProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<PropertyData | null>(
    null
  );
  const [addCategory, setAddCategory] = useState<string | undefined>(undefined);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(Object.keys(grouped))
  );
  const [error, setError] = useState("");

  function toggleCategory(cat: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }

  function handleAdd(category: string) {
    setEditingProperty(null);
    setAddCategory(category);
    setFormOpen(true);
  }

  function handleEdit(prop: PropertyData) {
    setEditingProperty(prop);
    setAddCategory(undefined);
    setFormOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Sigur doriti sa stergeti aceasta proprietate?")) return;

    setError("");
    const result = await deleteProperty(id);
    if (result.error) {
      setError(result.error);
    }
  }

  async function handleToggleActive(id: string, active: boolean) {
    setError("");
    const result = await togglePropertyActive(id, active);
    if (result.error) {
      setError(result.error);
    }
  }

  const categories = Object.keys(CATEGORY_LABELS);

  return (
    <>
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {categories.map((cat) => {
          const items = grouped[cat] ?? [];
          const isExpanded = expandedCategories.has(cat);

          return (
            <Card key={cat}>
              <CardHeader
                className="cursor-pointer select-none"
                onClick={() => toggleCategory(cat)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <CardTitle className="text-base">
                      {CATEGORY_LABELS[cat] ?? cat}
                    </CardTitle>
                    <Badge variant="secondary">{items.length}</Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAdd(cat);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adauga
                  </Button>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0">
                  {items.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      Nicio optiune adaugata in aceasta categorie
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="px-4 py-2 text-left font-medium">
                              Valoare
                            </th>
                            <th className="px-4 py-2 text-left font-medium">
                              Eticheta
                            </th>
                            <th className="px-4 py-2 text-left font-medium">
                              Ordine
                            </th>
                            <th className="px-4 py-2 text-left font-medium">
                              Stare
                            </th>
                            <th className="px-4 py-2 text-right font-medium">
                              Actiuni
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item) => (
                            <tr
                              key={item.id}
                              className="border-b transition-colors hover:bg-muted/30"
                            >
                              <td className="px-4 py-2 font-mono text-xs">
                                {item.value}
                              </td>
                              <td className="px-4 py-2">{item.label}</td>
                              <td className="px-4 py-2 text-muted-foreground">
                                {item.order}
                              </td>
                              <td className="px-4 py-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleActive(item.id, !item.active)
                                  }
                                  className="cursor-pointer"
                                >
                                  <Badge
                                    variant={
                                      item.active ? "default" : "secondary"
                                    }
                                  >
                                    {item.active ? "Activ" : "Inactiv"}
                                  </Badge>
                                </button>
                              </td>
                              <td className="px-4 py-2 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(item)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(item.id)}
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
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <PropertyForm
        open={formOpen}
        onOpenChange={setFormOpen}
        property={editingProperty}
        defaultCategory={addCategory}
      />
    </>
  );
}
