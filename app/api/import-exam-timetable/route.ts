import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { parseExamImportPayload } from "@/lib/exam-timetable-import/parse-import";
import { allowAiRequest } from "@/lib/server/ai-rate-limit";
import { verifyFirebaseIdToken } from "@/lib/server/verify-firebase-id-token";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"]);

type ImportExamBody = {
  idToken?: string;
  imageBase64?: string;
  mimeType?: string;
};

const SYSTEM_PROMPT =
  'Return ONLY a JSON object with key "entries" (array of exam rows). ' +
  'Each entry MUST include as many of these fields as visible: day, date, course, venue, time. ' +
  'day = weekday name (Monday, Tuesday, etc.). date = exam date exactly as printed or ISO YYYY-MM-DD. ' +
  'course = full course/module name and code if shown (e.g. "MATH 109 - Calculus"). ' +
  'venue = hall, room, or location. time = start time (e.g. "9:00 AM" or "14:30"). ' +
  'If the timetable has extra columns (e.g. "Seat", "Duration", "Invigilator"), put them in extras: { "ColumnName": "value" }. ' +
  'Also include optional "extraColumnLabels": string[] listing any non-standard column headers you detected. ' +
  'Extract EVERY exam row visible in the photo. Read carefully — do not invent data. Omit illegible fields.';

async function openAiParseExamImage(
  apiKey: string,
  model: string,
  mimeType: string,
  imageBase64: string,
): Promise<{ ok: true; payload: ReturnType<typeof parseExamImportPayload> } | { ok: false; status: number }> {
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract every exam row from this exam timetable photo. Include day, date, course, venue, and time when visible.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${imageBase64}`,
                    detail: "high",
                  },
                },
              ],
            },
          ],
          max_tokens: 3500,
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
          continue;
        }
        return { ok: false, status: response.status };
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
      };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) {
        return { ok: false, status: 502 };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        if (attempt < maxAttempts) {
          continue;
        }
        return { ok: false, status: 502 };
      }

      const payload = parseExamImportPayload(parsed);
      if (!payload) {
        if (attempt < maxAttempts) {
          continue;
        }
        return { ok: false, status: 422 };
      }

      return { ok: true, payload };
    } catch (error) {
      Sentry.captureException(error);
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
        continue;
      }
      return { ok: false, status: 502 };
    }
  }

  return { ok: false, status: 502 };
}

export async function POST(request: Request) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    return NextResponse.json({ error: "Missing Firebase project configuration." }, { status: 500 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY." }, { status: 503 });
  }

  const model = process.env.OPENAI_VISION_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  let body: ImportExamBody;
  try {
    body = (await request.json()) as ImportExamBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.idToken || typeof body.idToken !== "string") {
    return NextResponse.json({ error: "Missing idToken." }, { status: 401 });
  }

  const mimeType = typeof body.mimeType === "string" ? body.mimeType.trim().toLowerCase() : "";
  if (!ALLOWED_MIME.has(mimeType)) {
    return NextResponse.json({ error: "Use a JPEG, PNG, or WebP photo." }, { status: 400 });
  }

  const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64.trim() : "";
  if (!imageBase64) {
    return NextResponse.json({ error: "Missing image data." }, { status: 400 });
  }

  const byteLength = Math.ceil((imageBase64.length * 3) / 4);
  if (byteLength > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image is too large. Use a photo under 5 MB." }, { status: 400 });
  }

  let uid: string;
  try {
    uid = await verifyFirebaseIdToken(body.idToken, projectId);
  } catch {
    return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 });
  }

  if (!(await allowAiRequest(uid))) {
    return NextResponse.json({ error: "Too many AI requests this hour. Try later." }, { status: 429 });
  }

  const result = await openAiParseExamImage(apiKey, model, mimeType, imageBase64);
  if (!result.ok) {
    if (result.status === 422) {
      return NextResponse.json(
        { error: "Could not read an exam timetable from that photo. Try a clearer, well-lit picture." },
        { status: 422 },
      );
    }
    return NextResponse.json({ error: "Could not analyse the exam timetable photo. Try again." }, { status: 502 });
  }

  return NextResponse.json(result.payload);
}
