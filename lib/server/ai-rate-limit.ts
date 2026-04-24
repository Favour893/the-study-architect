const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;

const hitsByUid = new Map<string, number[]>();

export function allowAiRequest(uid: string): boolean {
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
