import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    // We don't throw here for vendor keys at import time, since some
    // deployments may only wire up one integration at first. Individual
    // clients check for their own keys before making a request.
    console.warn(`[env] ${name} is not set`);
  }
  return value ?? "";
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  backfillStartDate: process.env.BACKFILL_START_DATE ?? null,

  toast: {
    clientId: process.env.TOAST_CLIENT_ID ?? "",
    clientSecret: process.env.TOAST_CLIENT_SECRET ?? "",
    restaurantGuid: process.env.TOAST_RESTAURANT_GUID ?? "",
    baseUrl: process.env.TOAST_API_BASE_URL ?? "https://ws-api.toasttab.com",
  },
  pushOperations: {
    apiKey: process.env.PUSH_OPS_API_KEY ?? "",
    companyId: process.env.PUSH_OPS_COMPANY_ID ?? "",
    locationId: process.env.PUSH_OPS_LOCATION_ID ?? "",
    baseUrl: process.env.PUSH_OPS_API_BASE_URL ?? "https://api.pushoperations.com",
  },
  marginEdge: {
    apiKey: process.env.MARGIN_EDGE_API_KEY ?? "",
    restaurantId: process.env.MARGIN_EDGE_RESTAURANT_ID ?? "",
    baseUrl: process.env.MARGIN_EDGE_API_BASE_URL ?? "https://api.marginedge.com",
  },
};
