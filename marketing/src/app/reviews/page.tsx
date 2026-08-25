import { reviewsAdapter } from "@/lib/adapters";
import { StatTile } from "@/components/StatTile";

const SENTIMENT_CLASS: Record<string, string> = {
  positive: "text-status-good",
  negative: "text-status-critical",
  mixed: "text-status-warning",
};

export default async function ReviewsPage() {
  const [platforms, themes, recent] = await Promise.all([
    reviewsAdapter.getPlatformStats(),
    reviewsAdapter.getThemes(),
    reviewsAdapter.getRecentReviews(8),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Review Sentiment Tracker</h1>
      <p className="mt-1 text-sm text-ink-secondary">Rating trend, response time, and common themes in feedback.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {platforms.map((p) => (
          <StatTile
            key={p.platform}
            label={p.platform}
            value={`${p.averageRating.toFixed(1)}★`}
            sub={`${p.totalReviews} reviews · avg reply ${p.avgResponseTimeHours.toFixed(0)}h`}
            delta={
              <span className={`text-xs font-medium tabular ${p.ratingTrend30d >= 0 ? "text-status-good" : "text-status-critical"}`}>
                {p.ratingTrend30d >= 0 ? "+" : ""}
                {p.ratingTrend30d.toFixed(2)}
              </span>
            }
          />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-hairline bg-surface p-5">
          <h2 className="text-sm font-medium">Common themes in feedback</h2>
          <ul className="mt-4 space-y-3">
            {themes
              .sort((a, b) => b.mentions - a.mentions)
              .map((t) => (
                <li key={t.theme} className="flex items-center justify-between text-sm">
                  <span>{t.theme}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular text-ink-secondary">{t.mentions} mentions</span>
                    <span className={`text-xs font-medium capitalize ${SENTIMENT_CLASS[t.sentiment]}`}>{t.sentiment}</span>
                  </span>
                </li>
              ))}
          </ul>
        </div>

        <div className="rounded-xl border border-hairline bg-surface p-5">
          <h2 className="text-sm font-medium">Recent reviews</h2>
          <ul className="mt-4 space-y-4">
            {recent.map((r) => (
              <li key={r.id} className="border-b border-hairline pb-4 last:border-0 last:pb-0">
                <div className="flex items-center justify-between text-xs text-ink-secondary">
                  <span>
                    <span className="font-medium text-ink">{r.author}</span> · {r.platform} · {r.date}
                  </span>
                  <span className="tabular">{r.rating}★</span>
                </div>
                <p className="mt-1 text-sm">{r.text}</p>
                {!r.responded && <div className="mt-1 text-xs font-medium text-status-warning">Awaiting response</div>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
