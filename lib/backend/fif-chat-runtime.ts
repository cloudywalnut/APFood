import { runAgent, runOpenAIAgent, type AgentTool, type ChatMessage } from "./fif-agent";

type Provider = "gemini" | "openai";
type Runner = typeof runAgent;
type Config = { key?: string; fallbackKey?: string; model?: string };

export async function runFifChat(
  input: {
    system: string;
    messages: ChatMessage[];
    tools: AgentTool[];
    mode?: string;
    gemini: Config;
    openai: Config;
    budgetMs?: number;
    renderToolResult?: (name: string, output: unknown) => string | undefined;
  },
  runners: Record<Provider, Runner> = { gemini: runAgent, openai: runOpenAIAgent },
) {
  // Explicit modes make provider choice predictable. Auto may recover through a
  // second provider, always with the same owner-scoped, read-only tools.
  const order: Provider[] =
    input.mode === "openai" ? ["openai"] : input.mode === "gemini" ? ["gemini"] : ["gemini", "openai"];
  const providers = order.filter((provider) => input[provider].key);
  const failures: { provider: Provider; reason: string }[] = [];
  const deadline = Date.now() + Math.max(0, Math.min(20_000, input.budgetMs ?? 20_000));
  const observations: { name: string; output: unknown }[] = [];
  const tools = input.renderToolResult
    ? input.tools.map((tool) => ({
        ...tool,
        run: async (args: Record<string, unknown>) => {
          const output = await tool.run(args);
          observations.push({ name: tool.name, output });
          return output;
        },
      }))
    : input.tools;
  for (const [index, provider] of providers.entries()) {
    const remaining = deadline - Date.now();
    if (remaining < 1000) break;
    const budget = providers.length > index + 1 ? Math.min(10_000, remaining) : remaining;
    const keys = [input[provider].key!, input[provider].fallbackKey].filter(Boolean) as string[];
    let lastResult: Awaited<ReturnType<Runner>> | undefined;
    for (const key of keys) {
      const result = await runners[provider]({
        system: input.system,
        messages: input.messages,
        tools,
        key,
        model: input[provider].model,
        deadlineMs: budget,
        timeoutMs: Math.min(provider === "gemini" ? 18_000 : 10_000, budget),
      });
      if (result.ok) return { ...result, provider, failures };
      lastResult = result;
      failures.push({ provider, reason: result.failure ?? "No answer" });
      if (
        result.failure &&
        !["UNAUTHORIZED", "FORBIDDEN", "RATE_LIMIT", "SERVICE_UNAVAILABLE", "DEADLINE_EXCEEDED"].some((f) =>
          result.failure?.includes(f),
        )
      ) {
        break;
      }
    }
    for (const observation of observations.slice().reverse()) {
      const reply = input.renderToolResult?.(observation.name, observation.output);
      if (reply) return { reply, ok: true, toolsUsed: [observation.name], provider: "local" as const, failures };
    }
  }
  const last =
    input.messages
      .filter((message) => message.role === "user")
      .at(-1)
      ?.text.trim() ?? "";
  if (/^(?:h+i+|he+l+o+|he+y+|salam|hi there)[\s!.?]*$/i.test(last)) {
    return {
      reply: "Hi! I can help you find meals, check your orders or compare pickup times. What would you like to do?",
      ok: true,
      toolsUsed: [],
      provider: "local" as const,
      failures,
    };
  }
  return {
    reply:
      "I can’t reach the AI service right now. Please try your question again shortly. Your orders and campus menus are still available below.\n\n[View orders](/app/orders) · [Browse stalls](/app)",
    ok: false,
    toolsUsed: [],
    provider: "local" as const,
    failures,
  };
}
