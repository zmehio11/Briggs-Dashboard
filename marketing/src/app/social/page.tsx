import { socialAdapter } from "@/lib/adapters";
import { StatTile } from "@/components/StatTile";
import { DeltaBadge } from "@/components/DeltaBadge";
import { SocialReachChart } from "@/components/charts/SocialReachChart";

export default async function SocialPage() {
  const [platforms, postTrend] = await Promise.all([
    socialAdapter.getPlatformStats(),
    socialAdapter.getPostTrend(30),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Social Media Performance</h1>
      <p className="mt-1 text-sm text-ink-secondary">Reach, engagement, and follower growth by platform.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {platforms.map((p) => (
          <StatTile
            key={p.platform}
            label={p.platform}
            value={p.platform === "Google Business" ? "—" : p.followers.toLocaleString()}
            delta={
              p.platform !== "Google Business" && p.followers > 0 ? (
                <DeltaBadge pct={(p.followerDelta30d / p.followers) * 100} />
              ) : undefined
            }
            sub={
              p.platform === "Google Business"
                ? "See Local Visibility page"
                : `${(p.engagementRate * 100).toFixed(1)}% engagement · ${p.postsLast30d} posts (30d)`
            }
          />
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-hairline bg-surface p-5">
        <h2 className="text-sm font-medium">Post reach by platform — last 30 days</h2>
        <div className="mt-4">
          <SocialReachChart data={postTrend} />
        </div>
      </div>
    </div>
  );
}
