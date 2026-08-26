"use client";

import { useState } from "react";
import { generateCampaignBrief } from "@/lib/campaignBrief";
import { CampaignBrief } from "@/lib/types";

const EXAMPLE_GOALS = ["Boost Tuesday covers", "Get more repeat/VIP visits", "Grow our Google review count"];

export default function CampaignBriefPage() {
  const [goal, setGoal] = useState("");
  const [brief, setBrief] = useState<CampaignBrief | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!goal.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await generateCampaignBrief(goal);
      setBrief(result);
    } catch {
      setError("Couldn't generate a brief -- try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Campaign Brief Generator</h1>
      <p className="mt-1 text-sm text-ink-secondary">
        Describe a goal in plain language -- the brief is filled in from your own revenue, promo, review, and social data, not a template.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 rounded-xl border border-hairline bg-surface p-5">
        <label className="text-xs font-medium uppercase tracking-wide text-ink-muted">Goal</label>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="e.g. Boost Tuesday covers"
          rows={2}
          className="mt-2 w-full rounded-lg border border-hairline bg-plane p-3 text-sm outline-none focus:border-series-1"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {EXAMPLE_GOALS.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setGoal(example)}
              className="rounded-full border border-hairline px-3 py-1 text-xs text-ink-secondary hover:bg-black/[0.03]"
            >
              {example}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={loading || !goal.trim()}
          className="mt-4 rounded-lg bg-series-1 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Generating…" : "Generate brief"}
        </button>
        {error && <div className="mt-2 text-xs text-status-critical">{error}</div>}
      </form>

      {brief && (
        <div className="mt-6 rounded-xl border border-hairline bg-surface p-6">
          <h2 className="text-lg font-semibold">{brief.objective}</h2>

          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Audience</dt>
              <dd className="mt-1 text-sm">{brief.audience}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Channels</dt>
              <dd className="mt-1 text-sm">
                <ul className="list-inside list-disc">
                  {brief.channels.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Offer / creative direction</dt>
              <dd className="mt-1 text-sm">{brief.offer}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Budget</dt>
              <dd className="mt-1 text-sm tabular">{brief.budgetRange}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Timeline</dt>
              <dd className="mt-1 text-sm tabular">{brief.timeline}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Success metric</dt>
              <dd className="mt-1 text-sm">{brief.successMetric}</dd>
            </div>
          </dl>

          <div className="mt-5 border-t border-hairline pt-4">
            <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">Why this brief</div>
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-ink-secondary">
              {brief.rationale.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
