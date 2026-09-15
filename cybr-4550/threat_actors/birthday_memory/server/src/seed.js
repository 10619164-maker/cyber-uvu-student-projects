import 'dotenv/config';
import { pool, initSchema } from './db.js';

/**
 * Builds a date `offset` days from today, keeping the given birth year.
 * Falls back to Feb 28 when the birth year is not a leap year.
 */
function upcoming(offsetDays, birthYear) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offsetDays);

  const month = date.getUTCMonth() + 1;
  let day = date.getUTCDate();

  const isLeap = (birthYear % 4 === 0 && birthYear % 100 !== 0) || birthYear % 400 === 0;
  if (month === 2 && day === 29 && !isLeap) day = 28;

  return `${birthYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const people = [
  ['Ada', 'Lovelace', upcoming(0, 1990), '+1 415 555 0101', 'ada@example.com'],
  ['Grace', 'Hopper', upcoming(3, 1986), '+1 415 555 0102', 'grace@example.com'],
  ['Alan', 'Turing', upcoming(12, 1978), '+1 415 555 0103', 'alan@example.com'],
  ['Katherine', 'Johnson', upcoming(26, 1995), '+1 415 555 0104', 'katherine@example.com'],
  ['Linus', 'Torvalds', '1991-08-17', '+1 415 555 0105', 'linus@example.com'],
  ['Margaret', 'Hamilton', '1984-02-29', '+1 415 555 0106', 'margaret@example.com'],
  ['Hedy', 'Lamarr', '1974-11-09', '+1 415 555 0107', 'hedy@example.com'],
  ['Tim', 'Berners-Lee', '1999-06-08', '+1 415 555 0108', 'tim@example.com'],
];

async function seed() {
  await initSchema();

  const { rows } = await pool.query('SELECT count(*)::int AS count FROM birthdays');
  if (rows[0].count > 0) {
    console.log(`[seed] skipped, ${rows[0].count} record(s) already present`);
    await pool.end();
    return;
  }

  for (const person of people) {
    await pool.query(
      `INSERT INTO birthdays (first_name, last_name, birthdate, phone, email)
       VALUES ($1, $2, $3, $4, $5)`,
      person,
    );
  }

  console.log(`[seed] inserted ${people.length} sample birthdays`);
  await pool.end();
}

seed().catch((error) => {
  console.error('[seed] failed:', error.message);
  process.exit(1);
});
