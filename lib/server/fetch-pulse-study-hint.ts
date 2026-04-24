import type { PulseHintContext } from "@/lib/types/pulse-hint";

function clampContextSize(context: PulseHintContext): PulseHintContext {
  const trim = (s: string, max: number) => (s.length > max ? `${s.slice(0, max)}…` : s);
  return {
    pulseTitle: trim(context.pulseTitle, 400),
    pulseBody: trim(context.pulseBody, 1200),
    semesterName: context.semesterName ? trim(context.semesterName, 120) : undefined,
    progressPercent:
      typeof context.progressPercent === "number" && Number.isFinite(context.progressPercent)
        ? Math.min(100, Math.max(0, context.progressPercent))
        : context.progressPercent ?? null,
  };
}

export async function fetchPulseStudyHint(
  context: PulseHintContext,
  apiKey: string,
  model: string,
): Promise<string> {
  const safe = clampContextSize(context);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a concise study coach for university students. Respond with ONE short paragraph (at most 100 words) naming the single best next action for the next focused block of time. Be practical and specific to the context. Do not give medical or mental-health advice or diagnoses. If context is thin, suggest one simple, realistic study habit.",
        },
        {
          role: "user",
          content: JSON.stringify(safe),
        },
      ],
      max_tokens: 350,
      temperature: 0.55,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("Empty model response");
  }
  return text;
}
