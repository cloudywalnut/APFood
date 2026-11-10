import { z } from "zod";

export const labScenarios = ["light", "medium", "heavy"] as const;
export const labScenario = z.enum(labScenarios);
export const labReport = z.object({
  source: z.literal("local_simulated_orders"),
  scenario: labScenario,
  pickupWindow: z.iso.datetime({ offset: true }),
  initialAttempts: z.number().int().nonnegative(),
  acceptedAtTarget: z.number().int().nonnegative(),
  slotConflicts: z.number().int().nonnegative(),
  reroutedOrders: z.number().int().nonnegative(),
  unresolvedConflicts: z.number().int().nonnegative(),
  nextNoodlePickupAfterInitialDemand: z.iso.datetime({ offset: true }),
  targetBucketsBeforeCollection: z.array(z.object({
    vendor_id: z.string(),
    pickup_count: z.number().int().nonnegative(),
    reserved_units: z.number().int().nonnegative(),
    total_units: z.number().int().positive(),
  })),
  demoReceipts: z.array(z.object({ amount_sen: z.number().int() })),
});

export function trafficLabEnabled() {
  return process.env.NODE_ENV === "development" &&
    process.env.AP_FOOD_LOCAL_TRAFFIC_LAB === "1" &&
    (process.env.AP_FOOD_DATA_MODE ?? "mock") === "mock";
}
