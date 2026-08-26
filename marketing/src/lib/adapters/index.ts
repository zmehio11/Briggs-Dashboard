// Single place pages import adapters from. Swapping a mock for a live
// integration is a one-line change here -- nothing in src/app has to know.
export { toastAdapter as posAdapter } from "./pos";
export { reservationsAdapter } from "./reservations";
export { socialAdapter } from "./social";
export { emailAdapter } from "./email";
export { reviewsAdapter } from "./reviews";
export { gbpAdapter } from "./gbp";
export { attributionAdapter } from "./attribution";
export { outreachAdapter } from "./outreach";
