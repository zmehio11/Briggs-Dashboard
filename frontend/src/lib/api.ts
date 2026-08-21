export type Period = "weekly" | "monthly" | "yearly";

export interface Bucket {
  key: string;
  label: string;
  netSales: number;
  grossSales: number;
  laborCost: number;
  cogs: number;
  orderCount: number;
  laborPct: number | null;
  cogsPct: number | null;
  primeCostPct: number | null;
}

export async function fetchDashboard(period: Period): Promise<Bucket[]> {
  const res = await fetch(`/api/dashboard?period=${period}`);
  if (!res.ok) throw new Error(`Dashboard fetch failed: ${res.status}`);
  const data = await res.json();
  return data.buckets;
}
