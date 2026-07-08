export function normalizeTimeZone(value: string) {
  return value.trim();
}

export function isValidTimeZone(value: string) {
  const timeZone = normalizeTimeZone(value);

  if (!timeZone) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function getDateOnlyInTimeZone(date: Date, timeZone: string) {
  const normalizedTimeZone = normalizeTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: normalizedTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return null;
  }

  return `${year}-${month}-${day}`;
}
