const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;

const hitsByUid = new Map<string, number[]>();

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL?.trim() ?? "";
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ?? "";

function allowAiRequestInMemory(uid: string): boolean {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const prior = hitsByUid.get(uid) ?? [];
  const next = prior.filter((t) => t > cutoff);

  if (next.length >= MAX_REQUESTS_PER_WINDOW) {
    hitsByUid.set(uid, next);
    return false;
  }

  next.push(now);
  hitsByUid.set(uid, next);
  return true;
}

async function allowAiRequestInRedis(uid: string): Promise<boolean> {
  const key = `tsa:ai:rate:${uid}`;
  const incrRes = await fetch(`${UPSTASH_REDIS_REST_URL}/incr/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
    },
  });
  if (!incrRes.ok) {
    throw new Error("Redis increment failed");
  }
  const incrBody = (await incrRes.json()) as { result?: number };
  const nextCount = Number(incrBody.result ?? 0);
  if (!Number.isFinite(nextCount) || nextCount <= 0) {
    throw new Error("Redis increment result invalid");
  }

  if (nextCount === 1) {
    // First request in window: set expiration.
    await fetch(
      `${UPSTASH_REDIS_REST_URL}/expire/${encodeURIComponent(key)}/${Math.floor(WINDOW_MS / 1000)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
        },
      },
    );
  }

  return nextCount <= MAX_REQUESTS_PER_WINDOW;
}

export async function allowAiRequest(uid: string): Promise<boolean> {
  if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
    try {
      return await allowAiRequestInRedis(uid);
    } catch {
      // Fall back to in-memory limiter if Redis is unavailable.
      return allowAiRequestInMemory(uid);
    }
  }
  return allowAiRequestInMemory(uid);
}
