import { AttributionChannel } from "@/lib/types";
import { generateAttribution } from "@/lib/mock/attribution";

export interface AttributionAdapter {
  getChannelPerformance(): Promise<AttributionChannel[]>;
}

export const mockAttributionAdapter: AttributionAdapter = {
  async getChannelPerformance() {
    return generateAttribution();
  },
};

/**
 * TODO: unlike the other adapters, this isn't one vendor -- it's a
 * composite view stitched from POS (which promo code / UTM a check used),
 * reservations (booking source), and ad-platform spend (Meta/Google Ads
 * APIs) joined on date + channel. In practice this becomes either its own
 * small ETL job feeding a table this adapter reads, or a live join across
 * the other adapters at request time. See README.md "Marketing
 * Attribution" for the tracking setup (UTM convention, promo codes) this
 * depends on.
 */
export const attributionAdapter: AttributionAdapter = mockAttributionAdapter;
