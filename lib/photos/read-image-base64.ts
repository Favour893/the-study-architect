const MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

function normalizeMimeType(file: File): string {
  const fromType = file.type?.trim().toLowerCase();
  if (fromType && ALLOWED_MIME.has(fromType)) {
    return fromType === "image/heif" ? "image/heic" : fromType;
  }
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".png")) {
    return "image/png";
  }
  if (lowerName.endsWith(".webp")) {
    return "image/webp";
  }
  if (lowerName.endsWith(".gif")) {
    return "image/gif";
  }
  if (lowerName.endsWith(".heic") || lowerName.endsWith(".heif")) {
    return "image/heic";
  }
  return "image/jpeg";
}

export async function readImageAsBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  if (file.size > MAX_BYTES) {
    throw new Error("Photo must be under 5 MB.");
  }
  const mimeType = normalizeMimeType(file);
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return { base64: btoa(binary), mimeType };
}
