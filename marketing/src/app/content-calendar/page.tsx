import { getContentCalendar } from "@/lib/contentCalendar";
import { ContentCalendarPlatform } from "@/lib/types";

const PLATFORM_COLORS: Record<ContentCalendarPlatform, string> = {
  Instagram: "#2a78d6",
  Facebook: "#eb6834",
  "Google Business": "#eda100",
  Email: "#4a3aa7",
};

function PlatformTag({ platform }: { platform: ContentCalendarPlatform }) {
  const color = PLATFORM_COLORS[platform];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ color, backgroundColor: `${color}1a` }}
    >
      {platform}
    </span>
  );
}

export default async function ContentCalendarPage() {
  const items = await getContentCalendar(14);

  const byDate = new Map<string, typeof items>();
  for (const item of items) {
    const list = byDate.get(item.date) ?? [];
    list.push(item);
    byDate.set(item.date, list);
  }
  const dates = Array.from(byDate.keys()).sort();

  return (
    <div>
      <h1 className="text-2xl font-semibold">Content Calendar</h1>
      <p className="mt-1 text-sm text-ink-secondary">
        Next 14 days of suggested content, generated from your own revenue, review, and social data — not generic prompts.
      </p>

      <div className="mt-6 space-y-4">
        {dates.map((date) => {
          const dayItems = byDate.get(date)!;
          const weekday = new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "long", timeZone: "UTC" });
          return (
            <div key={date} className="rounded-xl border border-hairline bg-surface p-5">
              <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                {weekday} · {date}
              </div>
              <div className="mt-3 space-y-3">
                {dayItems.map((item, i) => (
                  <div key={i} className="rounded-lg border border-hairline p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <PlatformTag platform={item.platform} />
                      <span className="text-xs text-ink-muted">{item.format}</span>
                    </div>
                    <div className="mt-2 text-sm font-medium">{item.idea}</div>
                    <div className="mt-1 text-xs text-ink-secondary">{item.rationale}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
