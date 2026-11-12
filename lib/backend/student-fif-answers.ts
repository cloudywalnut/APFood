import { z } from "zod";
import type { AgentTool, ChatMessage } from "./fif-agent";

const text = z.string().max(500);
const price = z.string().regex(/^RM \d+\.\d{2}$/);
const page = z.string().regex(/^\/app(?:\/[A-Za-z0-9-]+)*$/);
const clean = (value: string) => value.replace(/[\[\]`*<>\r\n]/g, "");
const link = (href: string, label: string) => `[${clean(label)}](${href})`;
const order = z.object({ stall: text, status: text, pickup_window: text, total: price, page });

// Only render facts returned by the existing owner-scoped tools. This also
// preserves a successful lookup if the model's follow-up request times out.
export function renderStudentToolAnswer(name: string, output: unknown): string | undefined {
  if (name === "get_my_orders") {
    const result = z.object({ orders: z.array(order) }).safeParse(output);
    if (!result.success) return;
    if (!result.data.orders.length) return "No orders matched this lookup. [View orders](/app/orders)";
    return (
      "Your matching orders:\n" +
      result.data.orders
        .slice(0, 3)
        .map(
          (row) =>
            `- ${clean(row.stall)}: **${clean(row.status)}**, pickup ${clean(row.pickup_window)}, ${row.total}. ${link(row.page, "View order")}`,
        )
        .join("\n")
    );
  }
  if (name === "get_order_details") {
    const result = order.safeParse(output);
    if (!result.success) return;
    const row = result.data;
    return `Your ${clean(row.stall)} order is **${clean(row.status)}**. Pickup: ${clean(row.pickup_window)}. Total: ${row.total}. ${link(row.page, "View order")}`;
  }
  if (name === "search_menu") {
    const result = z
      .object({
        items: z.array(
          z.object({
            name: text,
            stall: text,
            price,
            was: price.optional(),
            availability: text,
            stall_paused: z.boolean(),
            page,
          }),
        ),
      })
      .safeParse(output);
    if (!result.success) return;
    if (!result.data.items.length) return "No menu items matched this search. [Browse stalls](/app/vendors)";
    return (
      "Current menu matches:\n" +
      result.data.items
        .slice(0, 3)
        .map(
          (row) =>
            `- **${clean(row.name)}** at ${clean(row.stall)}: ${row.price}${row.was ? ` (was ${row.was})` : ""}; ${row.stall_paused ? "stall paused" : clean(row.availability)}. ${link(row.page, "View " + row.name)}`,
        )
        .join("\n")
    );
  }
  if (name === "get_pickup_availability") {
    const result = z
      .object({
        windows: z.array(z.object({ stall: text, window: text, booked_percent: z.number().min(0).max(100), page })),
      })
      .safeParse(output);
    if (!result.success) return;
    if (!result.data.windows.length)
      return "No bookable pickup windows matched this lookup. [Browse stalls](/app/vendors)";
    return (
      "Soonest available pickup windows:\n" +
      result.data.windows
        .slice(0, 3)
        .map(
          (row) =>
            `- ${clean(row.stall)}: **${clean(row.window)}**, ${row.booked_percent}% of pickup slots booked. ${link(row.page, "View " + row.stall)}`,
        )
        .join("\n") +
      "\nCheckout confirms final availability. Bookings do not measure physical queues."
    );
  }
  if (name === "get_my_cart") {
    const result = z
      .object({
        items: z.array(z.object({ item: text, quantity: z.number().int().positive() })),
        estimated_total: price.optional(),
      })
      .safeParse(output);
    if (!result.success) return;
    if (!result.data.items.length) return "Your saved cart is empty. [Browse stalls](/app/vendors)";
    return (
      "Your saved cart:\n" +
      result.data.items
        .slice(0, 5)
        .map((row) => `- ${row.quantity} × ${clean(row.item)}`)
        .join("\n") +
      (result.data.estimated_total
        ? `\nEstimated total: ${result.data.estimated_total}. Checkout confirms extras and final prices.`
        : "") +
      "\n[View cart](/app/cart)"
    );
  }
  if (name === "list_stalls") {
    const result = z
      .object({ stalls: z.array(z.object({ name: text, cuisine: text, hours: text, next_pickup_window: text, page })) })
      .safeParse(output);
    if (!result.success) return;
    if (!result.data.stalls.length) return "No stalls matched this lookup. [Browse stalls](/app/vendors)";
    return (
      "Matching campus stalls:\n" +
      result.data.stalls
        .slice(0, 3)
        .map(
          (row) =>
            `- **${clean(row.name)}** (${clean(row.cuisine)}), hours ${clean(row.hours)}. Next pickup: ${clean(row.next_pickup_window)}. ${link(row.page, "View " + row.name)}`,
        )
        .join("\n")
    );
  }
}

export async function studentShortcut(messages: ChatMessage[], tools: AgentTool[]): Promise<string | undefined> {
  const question =
    messages
      .at(-1)
      ?.text.trim()
      .toLowerCase()
      .replace(/[?!.,]+$/g, "")
      .replace(/\s+/g, " ") ?? "";
  if (/^(?:h+i+|he+l+o+|he+y+|salam|hi there)$/.test(question))
    return "Hi! I can help with your orders, meal deals, cart or pickup times. What would you like to check?";
  // Exact requests only: questions with extra filters or conversational context
  // continue to Gemini instead of silently dropping the student's constraints.
  const requests: Record<string, { tool: string; args: Record<string, unknown> }> = {
    "meal deals today": { tool: "search_menu", args: { deals_only: true } },
    "show me meal deals today": { tool: "search_menu", args: { deals_only: true } },
    "where is my order": { tool: "get_my_orders", args: { filter: "active", limit: 3 } },
    "what is the status of my latest order": { tool: "get_my_orders", args: { filter: "recent", limit: 1 } },
    "fastest pickup now": { tool: "get_pickup_availability", args: { limit: 3 } },
    "what did i order last week": { tool: "get_my_orders", args: { filter: "recent", since_days: 7, limit: 5 } },
    "show my cart": { tool: "get_my_cart", args: {} },
    "what is in my cart": { tool: "get_my_cart", args: {} },
  };
  let request = requests[question];
  const budget = question.match(
    /^(?:which|what|show me|find) (?:(chinese|malay|indian|western) )?(?:meals?|items?|dishes|food) (?:costs? )?(under|below|less than|up to|at most) (?:rm|myr)\s*(\d+(?:\.\d{1,2})?)$/,
  );
  if (budget) {
    const maximumSen =
      Math.round(Number(budget[3]) * 100) - (["under", "below", "less than"].includes(budget[2]) ? 1 : 0);
    if (maximumSen > 0 && maximumSen <= 100_000)
      request = {
        tool: "search_menu",
        args: { ...(budget[1] ? { stall: budget[1] } : {}), max_price_rm: maximumSen / 100 },
      };
  }
  const tool = request && tools.find((entry) => entry.name === request.tool);
  if (!tool) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      tool.run(request.args),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Lookup timed out")), 6000);
      }),
    ]);
    const answer = renderStudentToolAnswer(tool.name, result);
    return question === "what did i order last week" && answer ? "Over the last seven days: " + answer : answer;
  } catch {
    return;
  } finally {
    clearTimeout(timer);
  }
}
