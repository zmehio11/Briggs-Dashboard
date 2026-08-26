"use client";

import { useTransition } from "react";
import { OutreachStatus } from "@/lib/types";
import { updateStatus } from "./actions";

const STATUSES: OutreachStatus[] = ["Not Contacted", "Contacted", "In Discussion", "Active", "Declined"];

export function StatusSelect({ id, status }: { id: string; status: OutreachStatus }) {
  const [isPending, startTransition] = useTransition();
  return (
    <select
      defaultValue={status}
      disabled={isPending}
      onChange={(e) => startTransition(() => updateStatus(id, e.target.value as OutreachStatus))}
      className="rounded-md border border-hairline bg-plane px-2 py-1 text-xs disabled:opacity-50"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
