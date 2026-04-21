"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@autoerebus/ui/components/button";
import { Trash2, Loader2 } from "lucide-react";

export default function DeleteOfferButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Sigur vrei să ștergi "${title}"?`)) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/service-offers/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Ștergerea a eșuat");
        return;
      }
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDelete}
      disabled={isDeleting}
      className="text-red-600 hover:text-red-700 hover:bg-red-50"
    >
      {isDeleting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </Button>
  );
}
