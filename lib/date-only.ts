export function isValidDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [yearValue, monthValue, dayValue] = value.split("-").map(Number);
  const date = new Date(Date.UTC(yearValue, monthValue - 1, dayValue));

  return (
    date.getUTCFullYear() === yearValue &&
    date.getUTCMonth() === monthValue - 1 &&
    date.getUTCDate() === dayValue
  );
}
