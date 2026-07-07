function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function getAdminEmailAllowlist() {
  const raw = process.env.ADMIN_EMAIL_ALLOWLIST ?? "";
  return raw
    .split(",")
    .map((value) => normalizeEmail(value))
    .filter((value) => value.length > 0);
}

export function isAdminEmail(email: string | null | undefined) {
  if (!email) {
    return false;
  }
  const normalized = normalizeEmail(email);
  return getAdminEmailAllowlist().includes(normalized);
}
