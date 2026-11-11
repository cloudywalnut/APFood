// Frontend composition root. No HTTP/auth/payment implementation is installed.
// A future authenticated adapter implements FoodServices at this boundary.
export { mockFoodServices as foodServices } from "./mock";
export type * from "./contracts";
