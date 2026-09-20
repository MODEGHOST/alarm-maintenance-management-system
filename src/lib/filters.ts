export type DateField = "occurred_at" | "created_at" | "scheduled_at" | "updated_at";

export type AdvancedFilterState = {
  keyword: string;
  status: string;
  machineId: string;
  location: string;
  type: string;
  dateFrom: string;
  dateTo: string;
};

export const emptyAdvancedFilter: AdvancedFilterState = {
  keyword: "",
  status: "",
  machineId: "",
  location: "",
  type: "",
  dateFrom: "",
  dateTo: "",
};

export function inDateRange(
  value: string | null | undefined,
  from: string,
  to: string,
) {
  if (!value) return !from && !to;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return false;
  if (from) {
    const f = Date.parse(from);
    if (!Number.isNaN(f) && t < f) return false;
  }
  if (to) {
    const end = Date.parse(to);
    if (!Number.isNaN(end)) {
      // include whole end day if date-only
      const endMs = to.length <= 10 ? end + 24 * 60 * 60 * 1000 - 1 : end;
      if (t > endMs) return false;
    }
  }
  return true;
}

export function matchesKeyword(haystack: string, keyword: string) {
  if (!keyword.trim()) return true;
  return haystack.toLowerCase().includes(keyword.trim().toLowerCase());
}
