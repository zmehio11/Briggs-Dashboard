import { AttributionChannel } from "@/lib/types";
import { generateAttribution } from "@/lib/mock/attribution";

export interface ReservationsAdapter {
  /** Bookings attributable to reservation-platform referrals (e.g. OpenTable "Discover" traffic). */
  getReferredBookings(): Promise<Pick<AttributionChannel, "channel" | "bookings">[]>;
}

export const mockReservationsAdapter: ReservationsAdapter = {
  async getReferredBookings() {
    return generateAttribution()
      .filter((c) => c.channel === "OpenTable")
      .map((c) => ({ channel: c.channel, bookings: c.bookings }));
  },
};

/**
 * TODO: real OpenTable / Resy adapter. See README.md "Reservations" for
 * the required API credentials.
 */
export const reservationsAdapter: ReservationsAdapter = mockReservationsAdapter;
