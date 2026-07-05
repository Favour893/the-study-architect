/** ISO calendar date YYYY-MM-DD stored in exam_date cells. */

export function parseFlexibleDateToIso(dateText: string, dayText?: string): string | null {
  const date = dateText.trim();
  if (!date) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  const parsed = new Date(date);
  if (!Number.isNaN(parsed.getTime())) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
  }
  if (dayText?.trim()) {
    const withDay = new Date(`${date} ${new Date().getFullYear()}`);
    if (!Number.isNaN(withDay.getTime())) {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${withDay.getFullYear()}-${pad(withDay.getMonth() + 1)}-${pad(withDay.getDate())}`;
    }
  }
  return null;
}

export function formatExamDateDisplay(isoOrText: string): string {
  const value = isoOrText.trim();
  if (!value) {
    return "";
  }
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : parseFlexibleDateToIso(value);
  if (!iso) {
    return value;
  }
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString([], {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function toDateInputValue(isoOrText: string): string {
  const value = isoOrText.trim();
  if (!value) {
    return "";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return parseFlexibleDateToIso(value) ?? "";
}

export function parseTimeToInputValue(timeText: string): string {
  const value = timeText.trim();
  if (!value) {
    return "";
  }
  if (/^\d{2}:\d{2}$/.test(value)) {
    return value;
  }
  const match12 = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hour = Number(match12[1]);
    const minute = match12[2];
    const meridiem = match12[3]?.toUpperCase();
    if (meridiem === "PM" && hour < 12) {
      hour += 12;
    }
    if (meridiem === "AM" && hour === 12) {
      hour = 0;
    }
    return `${String(hour).padStart(2, "0")}:${minute}`;
  }
  const match24 = value.match(/^(\d{1,2}):(\d{2})/);
  if (match24) {
    return `${String(Number(match24[1])).padStart(2, "0")}:${match24[2]}`;
  }
  return "";
}

export function formatTimeDisplay(hhmm: string): string {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) {
    return hhmm;
  }
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) {
    return hhmm;
  }
  const suffix = h < 12 ? "AM" : "PM";
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:${String(m).padStart(2, "0")} ${suffix}`;
}
