"use client";

import { useTransition } from "react";
import { deleteContact } from "./actions";

export function DeleteButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (confirm("Remove this contact?")) startTransition(() => deleteContact(id));
      }}
      className="text-xs text-ink-muted hover:text-status-critical disabled:opacity-50"
    >
      Remove
    </button>
  );
}
