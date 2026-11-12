import { z } from "zod";

export type Candidate = {
  id: string;
  title: string;
  evidence: string;
  href: string;
  action: string;
  priority: number;
  signals: Record<string, number>;
};

// The model selects an eligible action. All visible facts and links stay server-owned.
export async function rankActions(
  candidates: Candidate[],
  options: {
    key?: string;
    model?: string;
    fetcher?: typeof fetch;
  } = {},
) {
  const fallback = { recommendation: candidates[0], source: "rules" as "rules" | "gemini" };
  if (!options.key || candidates.length < 2) return fallback;
  const eligible = candidates.filter((item) => item.priority === candidates[0].priority);
  if (eligible.length < 2) return fallback;
  const output = z.object({ actionId: z.string(), evidenceId: z.string() }).strict();
  try {
    const response = await (options.fetcher ?? fetch)(
      "https://generativelanguage.googleapis.com/v1beta/models/" +
        encodeURIComponent(options.model ?? "gemini-2.5-flash") +
        ":generateContent",
      {
        method: "POST",
        signal: AbortSignal.timeout(5000),
        headers: { "Content-Type": "application/json", "x-goog-api-key": options.key },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: "Select one cafeteria action from the supplied aggregate signals. Prefer urgent work, lower congestion and earlier pickup. Return its actionId and the same evidenceId. Never invent identifiers.",
              },
            ],
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: JSON.stringify(
                    eligible.map((item) => ({ actionId: item.id, evidenceId: item.id, ...item.signals })),
                  ),
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                actionId: { type: "STRING", enum: eligible.map((item) => item.id) },
                evidenceId: { type: "STRING", enum: eligible.map((item) => item.id) },
              },
              required: ["actionId", "evidenceId"],
            },
            maxOutputTokens: 512,
            ...(!options.model || options.model === "gemini-2.5-flash"
              ? { thinkingConfig: { thinkingBudget: 0 } }
              : {}),
          },
        }),
      },
    );
    if (!response.ok) return fallback;
    const payload = await response.json();
    const text = payload.candidates?.[0]?.content?.parts
      ?.filter((part: { text?: string; thought?: boolean }) => part.text && !part.thought)
      .map((part: { text: string }) => part.text)
      .join("");
    const choice = output.parse(JSON.parse(text));
    const selected = eligible.find((item) => item.id === choice.actionId && item.id === choice.evidenceId);
    return selected ? { recommendation: selected, source: "gemini" as const } : fallback;
  } catch {
    return fallback;
  }
}
