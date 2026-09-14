const MS_PER_DAY = 86_400_000;

/** Parses a `YYYY-MM-DD` string into a UTC-midnight Date, avoiding TZ drift. */
export function parseISODate(value) {
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function todayUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * The next occurrence of a birthday on or after `from`.
 * Feb 29 birthdays fall back to Feb 28 in non-leap years.
 */
export function nextOccurrence(birthdate, from = todayUTC()) {
  const born = parseISODate(birthdate);
  const month = born.getUTCMonth();
  const day = born.getUTCDate();

  const build = (year) => {
    const safeDay = month === 1 && day === 29 && !isLeapYear(year) ? 28 : day;
    return new Date(Date.UTC(year, month, safeDay));
  };

  let candidate = build(from.getUTCFullYear());
  if (candidate < from) candidate = build(from.getUTCFullYear() + 1);
  return candidate;
}

export function daysUntilNext(birthdate, from = todayUTC()) {
  return Math.round((nextOccurrence(birthdate, from) - from) / MS_PER_DAY);
}

/** Age the person is turning on their next birthday. */
export function turningAge(birthdate, from = todayUTC()) {
  const born = parseISODate(birthdate);
  return nextOccurrence(birthdate, from).getUTCFullYear() - born.getUTCFullYear();
}

export function currentAge(birthdate, from = todayUTC()) {
  const next = turningAge(birthdate, from);
  return daysUntilNext(birthdate, from) === 0 ? next : next - 1;
}

/** Adds computed, read-only fields used by the UI. */
export function decorate(birthday, from = todayUTC()) {
  return {
    ...birthday,
    age: currentAge(birthday.birthdate, from),
    turningAge: turningAge(birthday.birthdate, from),
    daysUntil: daysUntilNext(birthday.birthdate, from),
    nextBirthday: nextOccurrence(birthday.birthdate, from).toISOString().slice(0, 10),
  };
}
