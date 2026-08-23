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
  budgetRevenue: number | null;
  budgetCogs: number | null;
  budgetLabor: number | null;
  budgetLaborPct: number | null;
  budgetCogsPct: number | null;
  budgetPrimeCostPct: number | null;
}

export async function fetchDashboard(period: Period): Promise<Bucket[]> {
  const res = await fetch(`/api/dashboard?period=${period}`);
  if (!res.ok) throw new Error(`Dashboard fetch failed: ${res.status}`);
  const data = await res.json();
  return data.buckets;
}

export interface DayOfWeekStat {
  day: string;
  avgQuantity: number | null;
  avgRevenue: number | null;
}

export interface ItemStat {
  itemGuid: string;
  itemName: string;
  totalQuantity: number;
  totalRevenue: number;
  byDayOfWeek: DayOfWeekStat[];
}

export interface ItemsResponse {
  daysObservedByWeekday: Record<string, number>;
  items: ItemStat[];
}

export async function fetchItems(): Promise<ItemsResponse> {
  const res = await fetch(`/api/items`);
  if (!res.ok) throw new Error(`Items fetch failed: ${res.status}`);
  return res.json();
}
