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
import { POST } from "../../app/api/suggest-topics/route";

function makeRequest(body: unknown) {
  return new Request("http://localhost:3000/api/suggest-topics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/suggest-topics POST", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "the-study-architect";
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.OPENAI_MODEL = "gpt-4o-mini";
    vi.mocked(verifyFirebaseIdToken).mockResolvedValue("user-123");
    vi.mocked(allowAiRequest).mockResolvedValue(true);
    global.fetch = vi.fn();
  });

  it("returns 400 when programmeOfStudy is missing", async () => {
    const response = await POST(
      makeRequest({
        idToken: "t",
        courseTitle: "Algorithms",
        programmeOfStudy: "",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("programme"),
    });
  });

  it("returns 401 when idToken is missing", async () => {
    const response = await POST(
      makeRequest({
        programmeOfStudy: "CS",
        courseTitle: "Algorithms",
      }),
    );

    expect(response.status).toBe(401);
  });

  it("returns topics on success", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ topics: ["Graphs", "Sorting"] }) } }],
      }),
    } as Response);

    const response = await POST(
      makeRequest({
        idToken: "good-token",
        programmeOfStudy: "BSc Computer Science",
        courseTitle: "Data Structures",
        courseCode: "CS201",
        existingTopicTitles: ["Arrays"],
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ topics: ["Graphs", "Sorting"] });
    expect(vi.mocked(Sentry.captureMessage)).not.toHaveBeenCalled();
  });
});
