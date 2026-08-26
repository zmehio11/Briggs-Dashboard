import { OutreachContact, OutreachStatus, OutreachType } from "@/lib/types";

function baseUrl(): string {
  return process.env.OPS_BACKEND_URL ?? "https://briggs-dashboard-production.up.railway.app";
}

export interface OutreachCreateInput {
  name: string;
  organization?: string;
  type: OutreachType;
  contactInfo?: string;
  notes?: string;
  nextActionDate?: string;
}

export interface OutreachUpdateInput {
  name?: string;
  organization?: string;
  type?: OutreachType;
  status?: OutreachStatus;
  contactInfo?: string;
  notes?: string;
  lastContactDate?: string;
  nextActionDate?: string;
}

export interface OutreachAdapter {
  list(): Promise<OutreachContact[]>;
  create(input: OutreachCreateInput): Promise<OutreachContact>;
  update(id: string, patch: OutreachUpdateInput): Promise<OutreachContact>;
  remove(id: string): Promise<void>;
}

/**
 * Unlike the vendor adapters, there's no mock variant here -- this is the
 * app's own data (owner-managed outreach contacts), not a third-party API,
 * so it's real from day one. Backed by the ops backend's Postgres (new
 * OutreachContact model + /api/outreach routes) rather than a separate
 * database, same reasoning as Revenue & Covers reusing /api/daily-sales.
 */
export const outreachAdapter: OutreachAdapter = {
  async list() {
    const res = await fetch(`${baseUrl()}/api/outreach`, { cache: "no-store" });
    if (!res.ok) throw new Error(`GET /api/outreach failed: ${res.status}`);
    return res.json();
  },
  async create(input) {
    const res = await fetch(`${baseUrl()}/api/outreach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`POST /api/outreach failed: ${res.status}`);
    return res.json();
  },
  async update(id, patch) {
    const res = await fetch(`${baseUrl()}/api/outreach/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`PATCH /api/outreach/${id} failed: ${res.status}`);
    return res.json();
  },
  async remove(id) {
    const res = await fetch(`${baseUrl()}/api/outreach/${id}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) throw new Error(`DELETE /api/outreach/${id} failed: ${res.status}`);
  },
};
