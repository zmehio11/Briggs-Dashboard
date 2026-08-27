import { useEffect, useState } from "react";
import {
  deleteItemMapping,
  fetchItemMappings,
  ItemMappingsResponse,
  MappedItem,
  RecipeOption,
  saveItemMapping,
  UnmatchedItem,
} from "../lib/api";

function RecipePicker({
  recipes,
  value,
  onChange,
  disabled,
}: {
  recipes: RecipeOption[];
  value: string;
  onChange: (recipeId: string) => void;
  disabled: boolean;
}) {
  const menu = recipes.filter((r) => r.categoryType === "MENU");
  const bar = recipes.filter((r) => r.categoryType === "BAR");
  const other = recipes.filter((r) => r.categoryType !== "MENU" && r.categoryType !== "BAR");
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Select a recipe —</option>
      {menu.length > 0 && (
        <optgroup label="Menu (Food)">
          {menu.map((r) => (
            <option key={r.recipeId} value={r.recipeId}>
              {r.recipeName} (${r.unitCost.toFixed(2)})
            </option>
          ))}
        </optgroup>
      )}
      {bar.length > 0 && (
        <optgroup label="Bar (Beverage)">
          {bar.map((r) => (
            <option key={r.recipeId} value={r.recipeId}>
              {r.recipeName} (${r.unitCost.toFixed(2)})
            </option>
          ))}
        </optgroup>
      )}
      {other.length > 0 && (
        <optgroup label="Other">
          {other.map((r) => (
            <option key={r.recipeId} value={r.recipeId}>
              {r.recipeName} (${r.unitCost.toFixed(2)})
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

function UnmatchedRow({ item, recipes, onMapped }: { item: UnmatchedItem; recipes: RecipeOption[]; onMapped: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currency = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  async function handleChange(recipeId: string) {
    if (!recipeId) return;
    setSaving(true);
    setError(null);
    try {
      await saveItemMapping(item.itemGuid, recipeId);
      onMapped();
    } catch (e: any) {
      setError(String(e.message ?? e));
      setSaving(false);
    }
  }

  return (
    <tr>
      <td>{item.itemName}</td>
      <td>{item.categoryName ?? "—"}</td>
      <td>{currency(item.totalRevenue)}</td>
      <td>{item.totalQuantity}</td>
      <td>
        <RecipePicker recipes={recipes} value="" onChange={handleChange} disabled={saving} />
        {error && <div style={{ color: "var(--clay)", fontSize: 12, marginTop: 4 }}>{error}</div>}
      </td>
    </tr>
  );
}

function MappedRow({ item, recipes, onChanged }: { item: MappedItem; recipes: RecipeOption[]; onChanged: () => void }) {
  const [saving, setSaving] = useState(false);
  const currency = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  async function handleChange(recipeId: string) {
    setSaving(true);
    try {
      await saveItemMapping(item.itemGuid, recipeId);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    try {
      await deleteItemMapping(item.itemGuid);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr>
      <td>{item.itemName}</td>
      <td>{item.categoryName ?? "—"}</td>
      <td>{currency(item.totalRevenue)}</td>
      <td>
        <RecipePicker recipes={recipes} value={item.recipeId} onChange={handleChange} disabled={saving} />
      </td>
      <td>
        <button type="button" onClick={handleRemove} disabled={saving} style={{ fontSize: 12 }}>
          Remove
        </button>
      </td>
    </tr>
  );
}

export function ItemMappingPanel() {
  const [data, setData] = useState<ItemMappingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    fetchItemMappings()
      .then(setData)
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  if (loading) return null;
  if (error) return <div className="banner banner-error">Couldn't load item mappings: {error}</div>;
  if (!data) return null;

  return (
    <>
      {data.unmatched.length > 0 && (
        <section className="table-card">
          <h2>Match Items to MarginEdge Recipes</h2>
          <p className="subtext">
            {data.unmatched.length} item(s) sold in Toast don't automatically match a MarginEdge recipe by name
            (different naming conventions between the two systems) -- sorted by revenue, so the highest-impact
            items are worth mapping first. Picking a recipe here overrides automatic matching immediately.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Toast Item</th>
                  <th>Category</th>
                  <th>Revenue</th>
                  <th>Qty Sold</th>
                  <th>MarginEdge Recipe</th>
                </tr>
              </thead>
              <tbody>
                {data.unmatched.map((item) => (
                  <UnmatchedRow key={item.itemGuid} item={item} recipes={data.recipes} onMapped={load} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data.mapped.length > 0 && (
        <section className="table-card">
          <h2>Manually Mapped Items</h2>
          <p className="subtext">Overrides in place. Change the recipe or remove to revert to automatic matching.</p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Toast Item</th>
                  <th>Category</th>
                  <th>Revenue</th>
                  <th>MarginEdge Recipe</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.mapped.map((item) => (
                  <MappedRow key={item.itemGuid} item={item} recipes={data.recipes} onChanged={load} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
