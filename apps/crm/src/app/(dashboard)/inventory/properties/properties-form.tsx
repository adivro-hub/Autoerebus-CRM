"use client";

import { useState, useEffect } from "react";
import { Button } from "@autoerebus/ui/components/button";
import { Input } from "@autoerebus/ui/components/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@autoerebus/ui/components/dialog";
import { createProperty, updateProperty } from "./actions";
import { CATEGORY_LABELS } from "./category-labels";

interface PropertyData {
  id: string;
  category: string;
  value: string;
  label: string;
  order: number;
  active: boolean;
}

interface PropertyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property?: PropertyData | null;
  defaultCategory?: string;
}

export function PropertyForm({
  open,
  onOpenChange,
  property,
  defaultCategory,
}: PropertyFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("");
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [order, setOrder] = useState("0");
  const [active, setActive] = useState(true);

  const isEdit = !!property;

  useEffect(() => {
    if (open) {
      if (property) {
        setCategory(property.category);
        setValue(property.value);
        setLabel(property.label);
        setOrder(String(property.order));
        setActive(property.active);
      } else {
        setCategory(defaultCategory ?? "bodyType");
        setValue("");
        setLabel("");
        setOrder("0");
        setActive(true);
      }
      setError("");
    }
  }, [open, property, defaultCategory]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.set("category", category);
    formData.set("value", value);
    formData.set("label", label);
    formData.set("order", order);
    formData.set("active", String(active));

    const result = isEdit
      ? await updateProperty(property.id, formData)
      : await createProperty(formData);

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editeaza Proprietate" : "Adauga Proprietate"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modificati datele proprietatii."
              : "Completati datele pentru o noua optiune de proprietate."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Categorie *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              disabled={isEdit}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {Object.entries(CATEGORY_LABELS).map(([key, lbl]) => (
                <option key={key} value={key}>
                  {lbl}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Valoare *"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ex: SEDAN"
            required
          />

          <Input
            label="Eticheta *"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex: Sedan"
            required
          />

          <Input
            label="Ordine"
            type="number"
            min={0}
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          />

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="property-active"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <label htmlFor="property-active" className="text-sm font-medium">
              Activ
            </label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Anuleaza
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? "Se salveaza..."
                : isEdit
                  ? "Salveaza"
                  : "Adauga"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
