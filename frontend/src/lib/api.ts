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
  opex: number | null;
  opexPct: number | null;
}

export async function fetchDashboard(period: Period): Promise<Bucket[]> {
  const res = await fetch(`/api/dashboard?period=${period}`);
  if (!res.ok) throw new Error(`Dashboard fetch failed: ${res.status}`);
  const data = await res.json();
  return data.buckets;
}

export interface MonthlyExpenseRow {
  year: number;
  month: number;
  category: string;
  amount: number;
}

export async function fetchExpenses(): Promise<MonthlyExpenseRow[]> {
  const res = await fetch(`/api/expenses`);
  if (!res.ok) throw new Error(`Expenses fetch failed: ${res.status}`);
  return res.json();
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

export type LaborGroup = "FOH" | "BOH" | "Management" | "Other";

export interface LaborGroupStat {
  avgCost: number;
  avgHours: number;
  pctOfSales: number | null;
}

export interface LaborDayStat {
  day: string;
  daysObserved: number;
  avgNetSales: number;
  avgLaborCost: number;
  laborPctOfSales: number | null;
  salesPerLaborHour: number | null;
  byGroup: Record<LaborGroup, LaborGroupStat>;
}

export interface LaborPositionStat {
  positionName: string;
  group: LaborGroup;
  avgHoursPerDay: number;
  avgCostPerDay: number;
}

export interface LaborResponse {
  daysObservedByWeekday: Record<string, number>;
  budgetLaborPct: number | null;
  byDayOfWeek: LaborDayStat[];
  byPosition: LaborPositionStat[];
}

export async function fetchLabor(): Promise<LaborResponse> {
  const res = await fetch(`/api/labor`);
  if (!res.ok) throw new Error(`Labor fetch failed: ${res.status}`);
  return res.json();
}

export interface SchedulePositionStat {
  positionName: string;
  group: LaborGroup;
  avgHeadcount: number;
  avgHours: number;
  avgCost: number;
}

export interface ScheduleDayStat {
  day: string;
  occurrencesUsed: number;
  predictedSales: number;
  targetLaborPct: number;
  targetLaborCost: number;
  projectedLaborCost: number;
  projectedLaborPct: number | null;
  overBudget: boolean;
  positions: SchedulePositionStat[];
}

export interface ScheduleResponse {
  weeksRequested: number;
  targetSource: "budget" | "estimate";
  days: ScheduleDayStat[];
}

export async function fetchSchedule(weeks = 8): Promise<ScheduleResponse> {
  const res = await fetch(`/api/schedule?weeks=${weeks}`);
  if (!res.ok) throw new Error(`Schedule fetch failed: ${res.status}`);
  return res.json();
}

export interface UnmatchedItem {
  itemGuid: string;
  itemName: string;
  categoryName: string | null;
  totalQuantity: number;
  totalRevenue: number;
}

export interface MappedItem extends UnmatchedItem {
  recipeId: string;
  recipeName: string;
}

export interface RecipeOption {
  recipeId: string;
  recipeName: string;
  categoryType: string;
  unitCost: number;
}

export interface ItemMappingsResponse {
  unmatched: UnmatchedItem[];
  mapped: MappedItem[];
  recipes: RecipeOption[];
}

export async function fetchItemMappings(): Promise<ItemMappingsResponse> {
  const res = await fetch(`/api/item-mappings`);
  if (!res.ok) throw new Error(`Item mappings fetch failed: ${res.status}`);
  return res.json();
}

export async function saveItemMapping(itemGuid: string, recipeId: string): Promise<void> {
  const res = await fetch(`/api/item-mappings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemGuid, recipeId }),
  });
  if (!res.ok) throw new Error(`Save mapping failed: ${res.status}`);
}

export async function deleteItemMapping(itemGuid: string): Promise<void> {
  const res = await fetch(`/api/item-mappings/${itemGuid}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`Delete mapping failed: ${res.status}`);
}
