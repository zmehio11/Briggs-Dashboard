/**
 * Normalizes a menu item name for matching Toast item names against
 * MarginEdge recipe names — the two systems share no common ID, and Toast
 * names sometimes carry stray leading punctuation (e.g. "..Briggs Burger").
 */
export function normalizeItemName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/^[^a-z0-9]+/, "")
    .replace(/[^a-z0-9]+$/, "")
    .replace(/\s+/g, " ");
}
