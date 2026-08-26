import { getWeeklyReport } from "@/lib/weeklyReport";
import { DeltaBadge } from "@/components/DeltaBadge";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-5">
      <h2 className="text-sm font-medium">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export default async function WeeklyReportPage() {
  const report = await getWeeklyReport();
  const currency = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Weekly Report</h1>
      <p className="mt-1 text-sm text-ink-secondary">
        {report.weekStart} – {report.weekEnd}, vs. the 7 days before
      </p>

      <div className="mt-4 rounded-xl border border-hairline bg-surface p-5">
        <div className="text-sm font-medium">{report.headline}</div>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-ink-secondary">
          {report.priorities.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Revenue & Covers">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular">{currency(report.revenue.total)}</span>
            <DeltaBadge pct={report.revenue.deltaPct} />
          </div>
          <div className="mt-2 text-xs text-ink-secondary">
            {report.revenue.covers.toLocaleString()} covers · {currency(report.revenue.avgCheck)} avg check
          </div>
        </Section>

        <Section title="Reviews">
          <div className="text-2xl font-semibold tabular">{report.reviews.avgRating.toFixed(1)}★ avg</div>
          <div className="mt-2 text-xs text-ink-secondary">{report.reviews.totalReviews} new review(s) this week</div>
          {report.reviews.bestReview && (
            <div className="mt-3 rounded-lg border border-hairline p-3 text-xs">
              <span className="font-medium">{report.reviews.bestReview.author}</span> · {report.reviews.bestReview.rating}★ ·{" "}
              {report.reviews.bestReview.platform}
              <div className="mt-1 text-ink-secondary">"{report.reviews.bestReview.text}"</div>
            </div>
          )}
        </Section>

        <Section title="Social">
          <div className="space-y-2">
            {report.social.map((p) => (
              <div key={p.platform} className="flex items-center justify-between text-sm">
                <span>{p.platform}</span>
                <span className="tabular text-ink-secondary">
                  {p.followers.toLocaleString()} followers{p.reach30d != null ? ` · ${p.reach30d.toLocaleString()} reach (30d)` : ""}
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Local Visibility">
          {report.visibility ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular">{report.visibility.views.toLocaleString()}</span>
                <DeltaBadge pct={report.visibility.deltaPct} />
              </div>
              <div className="mt-2 text-xs text-ink-secondary">{report.visibility.directionRequests.toLocaleString()} direction requests</div>
            </>
          ) : (
            <div className="text-sm text-ink-muted">No data.</div>
          )}
        </Section>

        <Section title="Top Campaign This Week">
          {report.topCampaign ? (
            <>
              <div className="text-sm font-medium">{report.topCampaign.name}</div>
              <div className="mt-1 text-xs text-ink-secondary">
                {report.topCampaign.channel} · {(report.topCampaign.redemptionRate * 100).toFixed(1)}% redemption ·{" "}
                {currency(report.topCampaign.revenueAttributed)} attributed
              </div>
            </>
          ) : (
            <div className="text-sm text-ink-muted">No campaigns sent this week.</div>
          )}
        </Section>

        <Section title="Top Attribution Channel">
          {report.topAttributionChannel ? (
            <>
              <div className="text-sm font-medium">{report.topAttributionChannel.channel}</div>
              <div className="mt-1 text-xs text-ink-secondary">
                {report.topAttributionChannel.bookings.toLocaleString()} bookings · {currency(report.topAttributionChannel.attributedRevenue)}{" "}
                attributed
              </div>
            </>
          ) : (
            <div className="text-sm text-ink-muted">No data.</div>
          )}
        </Section>
      </div>
    </div>
  );
}
