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
import { createModel, updateModel } from "./actions";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

interface MakeOption {
  id: string;
  name: string;
}

interface ModelData {
  id: string;
  name: string;
  slug: string;
  makeId: string;
}

interface ModelFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model?: ModelData | null;
  makes: MakeOption[];
}

export function ModelForm({ open, onOpenChange, model, makes }: ModelFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [makeId, setMakeId] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const isEdit = !!model;

  useEffect(() => {
    if (open) {
      if (model) {
        setMakeId(model.makeId);
        setName(model.name);
        setSlug(model.slug);
        setSlugManuallyEdited(true);
      } else {
        setMakeId(makes[0]?.id ?? "");
        setName("");
        setSlug("");
        setSlugManuallyEdited(false);
      }
      setError("");
    }
  }, [open, model, makes]);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugManuallyEdited) {
      setSlug(generateSlug(value));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.set("makeId", makeId);
    formData.set("name", name);
    formData.set("slug", slug);

    const result = isEdit
      ? await updateModel(model.id, formData)
      : await createModel(formData);

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
            {isEdit ? "Editeaza Model" : "Adauga Model"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modificati datele modelului auto."
              : "Completati datele pentru un nou model auto."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Marca *</label>
            <select
              value={makeId}
              onChange={(e) => setMakeId(e.target.value)}
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="" disabled>
                Selecteaza marca
              </option>
              {makes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Nume Model *"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Ex: Golf"
            required
          />

          <Input
            label="Slug"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugManuallyEdited(true);
            }}
            placeholder="golf"
          />

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
