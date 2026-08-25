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

export type CategoryGroup = "Food" | "Beverage" | "Other";
export type Quadrant = "Star" | "Plowhorse" | "Puzzle" | "Dog";

export interface ItemStat {
  itemGuid: string;
  itemName: string;
  categoryName: string | null;
  categoryGroup: CategoryGroup;
  totalQuantity: number;
  totalRevenue: number;
  unitCost: number | null;
  totalCost: number | null;
  margin: number | null;
  marginPct: number | null;
  quadrant: Quadrant | null;
  byDayOfWeek: DayOfWeekStat[];
}

export interface ItemsResponse {
  daysObservedByWeekday: Record<string, number>;
  matchedCostCount: number;
  unmatchedCostCount: number;
  items: ItemStat[];
}

export async function fetchItems(): Promise<ItemsResponse> {
  const res = await fetch(`/api/items`);
  if (!res.ok) throw new Error(`Items fetch failed: ${res.status}`);
  return res.json();
}

export type FlagType = "self_approved_discount" | "large_discount" | "void_after_payment" | "multiple_voids" | "refund";
export type FlagSeverity = "high" | "medium";

export interface TransactionFlag {
  id: string;
  businessDate: string;
  employeeName: string | null;
  flagType: FlagType;
  severity: FlagSeverity;
  amount: number;
  description: string;
}

export interface EmployeeFlagSummary {
  employeeName: string;
  count: number;
  totalAmount: number;
}

export interface FlagsResponse {
  flags: TransactionFlag[];
  byEmployee: EmployeeFlagSummary[];
}

export async function fetchFlags(): Promise<FlagsResponse> {
  const res = await fetch(`/api/flags`);
  if (!res.ok) throw new Error(`Flags fetch failed: ${res.status}`);
  return res.json();
}
