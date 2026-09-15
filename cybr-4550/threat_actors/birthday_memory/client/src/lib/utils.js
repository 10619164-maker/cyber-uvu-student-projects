export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** `YYYY-MM-DD` → UTC-midnight Date, so the calendar never drifts a day. */
export function parseISODate(value) {
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function toISODate(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export function todayISO() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

export function formatLongDate(iso) {
  const date = parseISODate(iso);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

export function formatDayMonth(iso) {
  const date = parseISODate(iso);
  return `${MONTHS[date.getUTCMonth()].slice(0, 3)} ${date.getUTCDate()}`;
}

export function countdownLabel(daysUntil) {
  if (daysUntil === 0) return 'Today!';
  if (daysUntil === 1) return 'Tomorrow';
  if (daysUntil < 7) return `In ${daysUntil} days`;
  if (daysUntil < 30) return `In ${Math.round(daysUntil / 7)} weeks`;
  return `In ${daysUntil} days`;
}

export function fullName(person) {
  return `${person.firstName} ${person.lastName}`.trim();
}

export function initials(person) {
  return `${person.firstName?.[0] ?? ''}${person.lastName?.[0] ?? ''}`.toUpperCase();
}

/** Stable 32-bit hash so a person always gets the same colors. */
function hash(text) {
  let value = 0;
  for (let i = 0; i < text.length; i += 1) {
    value = (value << 5) - value + text.charCodeAt(i);
    value |= 0;
  }
  return Math.abs(value);
}

const PALETTE = [
  ['#ff4d9d', '#ff9a3c'],
  ['#8b5cff', '#3cc8ff'],
  ['#00e0a4', '#7bff6b'],
  ['#ffb01f', '#ff5f6d'],
  ['#3c7bff', '#a855f7'],
  ['#ff6ec7', '#7f5cff'],
  ['#12d8fa', '#4ade80'],
  ['#fa709a', '#fee140'],
];

/** Deterministic gradient stops derived from a person's identity. */
export function gradientFor(person) {
  const key = `${person.id ?? ''}${person.firstName ?? ''}${person.lastName ?? ''}`;
  const [from, to] = PALETTE[hash(key) % PALETTE.length];
  return { from, to, css: `linear-gradient(135deg, ${from}, ${to})` };
}

/**
 * Builds a 6-row calendar grid for the given month.
 * Returns cells tagged with their ISO date and whether they belong to the month.
 */
export function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const start = new Date(firstOfMonth);
  start.setUTCDate(start.getUTCDate() - firstOfMonth.getUTCDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return {
      iso: toISODate(date),
      day: date.getUTCDate(),
      month: date.getUTCMonth(),
      inMonth: date.getUTCMonth() === month,
    };
  });
}

/** Groups people by `MM-DD` so calendar cells can look them up cheaply. */
export function groupByMonthDay(people) {
  const map = new Map();
  for (const person of people) {
    const key = person.birthdate.slice(5, 10);
    const bucket = map.get(key);
    if (bucket) bucket.push(person);
    else map.set(key, [person]);
  }
  return map;
}
