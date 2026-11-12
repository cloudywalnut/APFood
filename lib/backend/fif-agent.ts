// Shared FIF agent loop (Gemini and OpenAI tool calling). Role-specific prompts and tools live in
// separate files, e.g. student-fif-chat.ts, so vendor or admin agents can reuse this loop.
import { z } from "zod";

// A tool the model may call. Tools run on the server with the student's own database session,
// so row-level security still decides what can be read. Tools are read-only.
export type AgentTool = {
  name: string;
  description: string;
  parameters: { type: "OBJECT"; properties: Record<string, unknown>; required?: string[] };
  run: (args: Record<string, unknown>) => Promise<unknown>;
};

export type ChatMessage = { role: "user" | "assistant"; text: string };

type Part = {
  text?: string;
  thought?: boolean;
  functionCall?: { id?: string; name: string; args?: Record<string, unknown> };
  [key: string]: unknown;
};
type Content = { role: "user" | "model"; parts: Part[] };

export const fallbackReply = "Sorry, I couldn’t work that out just now. Please try again in a moment.";

const candidate = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({ role: z.string().optional(), parts: z.array(z.record(z.string(), z.unknown())) }),
      }),
    )
    .min(1),
});

export async function runAgent(input: {
  system: string;
  messages: ChatMessage[];
  tools: AgentTool[];
  key: string;
  model?: string;
  fetcher?: typeof fetch;
  maxSteps?: number;
  timeoutMs?: number;
  deadlineMs?: number;
}) {
  const deadline = Date.now() + (input.deadlineMs ?? 13_000);
  const model = input.model || "gemini-3.5-flash";
  const fetcher = input.fetcher ?? fetch;
  const contents: Content[] = input.messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.text }],
  }));
  const declarations = input.tools.map(({ name, description, parameters }) => ({ name, description, parameters }));
  const toolsUsed: string[] = [];
  const maxSteps = input.maxSteps ?? 4;

  for (let step = 0; step < maxSteps; step++) {
    const remaining = deadline - Date.now();
    if (remaining < 1_000) break;
    const lastStep = step === maxSteps - 1 || remaining < 4_000;
    let response: Response;
    try {
      response = await fetcher(
        "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent",
        {
          method: "POST",
          signal: AbortSignal.timeout(Math.min(input.timeoutMs ?? 8_000, remaining)),
          headers: { "Content-Type": "application/json", "x-goog-api-key": input.key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: input.system }] },
            contents,
            tools: [{ functionDeclarations: declarations }],
            // On the last step the model must answer with what it has.
            toolConfig: { functionCallingConfig: { mode: lastStep ? "NONE" : "AUTO" } },
            generationConfig: {
              maxOutputTokens: 1024,
              temperature: 0.3,
              ...(model === "gemini-2.5-flash" ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
            },
          }),
        },
      );
    } catch (error) {
      const name = error instanceof Error ? error.name : "Error";
      return { reply: fallbackReply, toolsUsed, ok: false, failure: "request " + name + " at step " + step };
    }
    if (!response.ok)
      return { reply: fallbackReply, toolsUsed, ok: false, failure: "HTTP " + response.status + " at step " + step };
    const parsed = candidate.safeParse(await response.json().catch(() => null));
    if (!parsed.success)
      return { reply: fallbackReply, toolsUsed, ok: false, failure: "unexpected response at step " + step };
    const parts = parsed.data.candidates[0].content.parts as Part[];
    const calls = parts.filter((part) => part.functionCall?.name);

    if (!calls.length) {
      const text = parts
        .filter((part) => typeof part.text === "string" && !part.thought)
        .map((part) => part.text)
        .join("")
        .trim();
      return text
        ? { reply: text.slice(0, 2000), toolsUsed, ok: true }
        : { reply: fallbackReply, toolsUsed, ok: false, failure: "empty answer at step " + step };
    }

    // Echo the model turn unchanged so any thought signatures are preserved.
    contents.push({ role: "model", parts });
    const results: Part[] = [];
    for (const part of calls.slice(0, 4)) {
      const call = part.functionCall!;
      const tool = input.tools.find((entry) => entry.name === call.name);
      let output: unknown;
      if (!tool) output = { error: "Unknown tool." };
      else {
        toolsUsed.push(tool.name);
        try {
          output = await tool.run(call.args ?? {});
        } catch {
          output = { error: "This information is unavailable right now." };
        }
      }
      results.push({
        functionResponse: {
          ...(call.id ? { id: call.id } : {}),
          name: call.name,
          response: { result: output },
        },
      });
    }
    contents.push({ role: "user", parts: results });
  }
  return { reply: fallbackReply, toolsUsed, ok: false, failure: "out of steps or time" };
}

// Tool schemas are written in Gemini's upper-case types; OpenAI expects JSON Schema's lower-case ones.
function jsonSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(jsonSchema);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      key === "type" && typeof entry === "string" ? entry.toLowerCase() : jsonSchema(entry),
    ]),
  );
}

const completion = z.object({
  choices: z
    .array(
      z.object({
        message: z
          .object({
            content: z.string().nullable().optional(),
            tool_calls: z
              .array(
                z.object({
                  id: z.string(),
                  type: z.string(),
                  function: z.object({ name: z.string(), arguments: z.string() }),
                }),
              )
              .optional(),
          })
          .passthrough(),
      }),
    )
    .min(1),
});

// Same loop as runAgent, using OpenAI Chat Completions with function calling.
export async function runOpenAIAgent(input: Parameters<typeof runAgent>[0]) {
  const deadline = Date.now() + (input.deadlineMs ?? 13_000);
  const model = input.model || "gpt-6-luna";
  const fetcher = input.fetcher ?? fetch;
  const messages: Record<string, unknown>[] = [
    { role: "system", content: input.system },
    ...input.messages.map((message) => ({ role: message.role, content: message.text })),
  ];
  const tools = input.tools.map(({ name, description, parameters }) => ({
    type: "function",
    function: { name, description, parameters: jsonSchema(parameters) },
  }));
  const toolsUsed: string[] = [];
  const maxSteps = input.maxSteps ?? 4;

  for (let step = 0; step < maxSteps; step++) {
    const remaining = deadline - Date.now();
    if (remaining < 1_000) break;
    const lastStep = step === maxSteps - 1 || remaining < 4_000;
    let response: Response;
    try {
      response = await fetcher("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(Math.min(input.timeoutMs ?? 8_000, remaining)),
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + input.key },
        body: JSON.stringify({
          model,
          messages,
          ...(tools.length ? { tools, tool_choice: lastStep ? "none" : "auto" } : {}),
          // GPT-6 models only allow function tools on Chat Completions with reasoning switched off.
          reasoning_effort: "none",
          max_completion_tokens: 1024,
        }),
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : "Error";
      return { reply: fallbackReply, toolsUsed, ok: false, failure: "request " + name + " at step " + step };
    }
    if (!response.ok)
      return { reply: fallbackReply, toolsUsed, ok: false, failure: "HTTP " + response.status + " at step " + step };
    const parsed = completion.safeParse(await response.json().catch(() => null));
    if (!parsed.success)
      return { reply: fallbackReply, toolsUsed, ok: false, failure: "unexpected response at step " + step };
    const message = parsed.data.choices[0].message;
    const calls = message.tool_calls?.filter((call) => call.type === "function") ?? [];

    if (!calls.length) {
      const text = (message.content ?? "").trim();
      return text
        ? { reply: text.slice(0, 2000), toolsUsed, ok: true }
        : { reply: fallbackReply, toolsUsed, ok: false, failure: "empty answer at step " + step };
    }

    messages.push(message);
    for (const call of calls) {
      const tool = input.tools.find((entry) => entry.name === call.function.name);
      let output: unknown;
      if (!tool || calls.indexOf(call) >= 4) output = { error: tool ? "Too many lookups at once." : "Unknown tool." };
      else {
        toolsUsed.push(tool.name);
        try {
          const args = JSON.parse(call.function.arguments || "{}");
          output = await tool.run(args && typeof args === "object" ? args : {});
        } catch {
          output = { error: "This information is unavailable right now." };
        }
      }
      // Every tool call needs a matching tool message, or OpenAI rejects the next request.
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ result: output }) });
    }
  }
  return { reply: fallbackReply, toolsUsed, ok: false, failure: "out of steps or time" };
}
