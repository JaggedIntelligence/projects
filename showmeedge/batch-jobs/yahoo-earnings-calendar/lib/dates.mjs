const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateIsoDate(value, flagName = "date") {
  if (!ISO_DATE_RE.test(String(value ?? ""))) {
    throw new Error(`${flagName} must be in YYYY-MM-DD format`);
  }
}

export function parseIsoDateUtc(value) {
  validateIsoDate(value);
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatIsoDateUtc(date) {
  return date.toISOString().slice(0, 10);
}

export function addUtcDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function getStrictSundayToSaturdayPairs(startDateStr, endDateStr) {
  validateIsoDate(startDateStr, "--from");
  validateIsoDate(endDateStr, "--to");

  let start = parseIsoDateUtc(startDateStr);
  const end = parseIsoDateUtc(endDateStr);

  while (start.getUTCDay() !== 0) {
    start = addUtcDays(start, 1);
  }

  if (start > end) {
    return [];
  }

  const pairs = [];
  for (let currentLeft = start; currentLeft <= end; currentLeft = addUtcDays(currentLeft, 7)) {
    const currentRight = addUtcDays(currentLeft, 6);
    pairs.push([formatIsoDateUtc(currentLeft), formatIsoDateUtc(currentRight)]);
  }

  return pairs;
}

