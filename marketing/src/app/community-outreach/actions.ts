"use server";

import { revalidatePath } from "next/cache";
import { outreachAdapter } from "@/lib/adapters/outreach";
import { OutreachStatus, OutreachType } from "@/lib/types";

export async function addContact(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await outreachAdapter.create({
    name,
    organization: String(formData.get("organization") || "") || undefined,
    type: (String(formData.get("type") || "Other") as OutreachType),
    contactInfo: String(formData.get("contactInfo") || "") || undefined,
    notes: String(formData.get("notes") || "") || undefined,
    nextActionDate: String(formData.get("nextActionDate") || "") || undefined,
  });
  revalidatePath("/community-outreach");
}

export async function updateStatus(id: string, status: OutreachStatus) {
  await outreachAdapter.update(id, { status });
  revalidatePath("/community-outreach");
}

export async function deleteContact(id: string) {
  await outreachAdapter.remove(id);
  revalidatePath("/community-outreach");
}
