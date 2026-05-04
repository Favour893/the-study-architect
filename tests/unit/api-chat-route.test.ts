import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/ai-rate-limit", () => ({
  allowAiRequest: vi.fn(),
}));

vi.mock("@/lib/server/verify-firebase-id-token", () => ({
  verifyFirebaseIdToken: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
}));

import * as Sentry from "@sentry/nextjs";
import { allowAiRequest } from "@/lib/server/ai-rate-limit";
import { verifyFirebaseIdToken } from "@/lib/server/verify-firebase-id-token";
import { POST } from "../../app/api/chat/route";

function makeRequest(body: unknown) {
  return new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/chat POST", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "the-study-architect";
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.OPENAI_MODEL = "gpt-4o-mini";
    vi.mocked(verifyFirebaseIdToken).mockResolvedValue("user-123");
    vi.mocked(allowAiRequest).mockResolvedValue(true);
  });

  it("returns 401 when idToken is missing", async () => {
    const response = await POST(
      makeRequest({
        topics: [{ courseName: "Math", topicTitle: "Vectors" }],
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Missing idToken." });
  });

  it("returns 401 when token verification fails", async () => {
    vi.mocked(verifyFirebaseIdToken).mockRejectedValue(new Error("bad token"));

    const response = await POST(
      makeRequest({
        idToken: "bad-token",
        topics: [{ courseName: "Math", topicTitle: "Vectors" }],
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Invalid or expired session." });
  });

  it("returns 429 when rate limit denies request", async () => {
    vi.mocked(allowAiRequest).mockResolvedValue(false);

    const response = await POST(
      makeRequest({
        idToken: "good-token",
        topics: [{ courseName: "Math", topicTitle: "Vectors" }],
      }),
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ error: "Too many AI requests this hour. Try later." });
  });

  it("returns 502 and captures Sentry message when OpenAI fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);

    const response = await POST(
      makeRequest({
        idToken: "good-token",
        topics: [{ courseName: "Math", topicTitle: "Vectors" }],
      }),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "Could not generate mission right now." });
    expect(vi.mocked(Sentry.captureMessage)).toHaveBeenCalledTimes(1);
  });

  it("returns mission and reasoning on success", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                mission: "Revise vectors with 10 worked examples. Summarize mistakes in a one-page sheet.",
                reasoning: "Selected because it is taught and tied to your next class.",
              }),
            },
          },
        ],
      }),
    } as Response);

    const response = await POST(
      makeRequest({
        idToken: "good-token",
        topics: [{ courseName: "Math", topicTitle: "Vectors" }],
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      mission: "Revise vectors with 10 worked examples. Summarize mistakes in a one-page sheet.",
      reasoning: "Selected because it is taught and tied to your next class.",
    });
  });
});
