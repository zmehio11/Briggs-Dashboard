import { CampaignStat } from "@/lib/types";
import { generateCampaigns } from "@/lib/mock/campaigns";

export interface EmailAdapter {
  getCampaigns(): Promise<CampaignStat[]>;
}

export const mockEmailAdapter: EmailAdapter = {
  async getCampaigns() {
    return generateCampaigns();
  },
};

/**
 * TODO: real Mailchimp / Klaviyo adapter (email) merged with a Twilio or
 * Attentive adapter (SMS) into this same CampaignStat[] shape. See
 * README.md "Email / SMS" for required API keys per provider.
 */
export const emailAdapter: EmailAdapter = mockEmailAdapter;
