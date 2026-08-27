import { useState } from "react";

export type SortDir = "asc" | "desc";
export interface SortState {
  key: string;
  dir: SortDir;
}

/** Sorts nulls last regardless of direction -- a missing value isn't "low". */
export function sortByKey<T>(list: T[], sort: SortState, getValue: (item: T, key: string) => string | number | null): T[] {
  return [...list].sort((a, b) => {
    const av = getValue(a, sort.key);
    const bv = getValue(b, sort.key);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv) : (av as number) - (bv as number);
    return sort.dir === "asc" ? cmp : -cmp;
  });
}

export function useSort(initial: SortState) {
  const [sort, setSort] = useState<SortState>(initial);
  const onSort = (key: string, defaultDir: SortDir) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: defaultDir }));
  };
  return { sort, onSort };
}

export function SortableTh({
  label,
  sortKey,
  defaultDir,
  sort,
  onSort,
}: {
  label: string;
  sortKey: string;
  defaultDir: SortDir;
  sort: SortState;
  onSort: (key: string, defaultDir: SortDir) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <th className={`sortable${active ? " active" : ""}`} onClick={() => onSort(sortKey, defaultDir)}>
      {label}
      {active ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );
}
