import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const outreachRouter = Router();

function serialize(row: {
  id: string;
  name: string;
  organization: string | null;
  type: string;
  status: string;
  contactInfo: string | null;
  notes: string | null;
  lastContactDate: Date | null;
  nextActionDate: Date | null;
}) {
  return {
    id: row.id,
    name: row.name,
    organization: row.organization,
    type: row.type,
    status: row.status,
    contactInfo: row.contactInfo,
    notes: row.notes,
    lastContactDate: row.lastContactDate ? row.lastContactDate.toISOString().slice(0, 10) : null,
    nextActionDate: row.nextActionDate ? row.nextActionDate.toISOString().slice(0, 10) : null,
  };
}

// GET /api/outreach -- list every contact, soonest next-action first.
outreachRouter.get("/", async (_req, res) => {
  const rows = await prisma.outreachContact.findMany({
    orderBy: [{ nextActionDate: "asc" }, { updatedAt: "desc" }],
  });
  res.json(rows.map(serialize));
});

// POST /api/outreach -- create a contact.
outreachRouter.post("/", async (req, res) => {
  const { name, organization, type, contactInfo, notes, nextActionDate } = req.body ?? {};
  if (!name || !type) {
    res.status(400).json({ error: "name and type are required" });
    return;
  }
  const row = await prisma.outreachContact.create({
    data: {
      name,
      organization: organization || null,
      type,
      contactInfo: contactInfo || null,
      notes: notes || null,
      nextActionDate: nextActionDate ? new Date(nextActionDate) : null,
    },
  });
  res.status(201).json(serialize(row));
});

// PATCH /api/outreach/:id -- update any subset of fields.
outreachRouter.patch("/:id", async (req, res) => {
  const { name, organization, type, status, contactInfo, notes, lastContactDate, nextActionDate } = req.body ?? {};
  try {
    const row = await prisma.outreachContact.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(organization !== undefined && { organization: organization || null }),
        ...(type !== undefined && { type }),
        ...(status !== undefined && { status }),
        ...(contactInfo !== undefined && { contactInfo: contactInfo || null }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(lastContactDate !== undefined && { lastContactDate: lastContactDate ? new Date(lastContactDate) : null }),
        ...(nextActionDate !== undefined && { nextActionDate: nextActionDate ? new Date(nextActionDate) : null }),
      },
    });
    res.json(serialize(row));
  } catch {
    res.status(404).json({ error: "not found" });
  }
});

// DELETE /api/outreach/:id
outreachRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.outreachContact.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "not found" });
  }
});
