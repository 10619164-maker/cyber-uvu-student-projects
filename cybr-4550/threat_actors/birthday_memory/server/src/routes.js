import { Router } from 'express';
import { pool, mapRow } from './db.js';
import { validateBirthday } from './validate.js';
import { decorate } from './dates.js';

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SELECT_COLUMNS = `
  id, first_name, last_name, birthdate, phone, email, created_at, updated_at
`;

// Domain 1 (API) hardening: GET / and GET /upcoming previously fetched the entire
// table with no bound at all - the "unbounded query" DoS condition flagged in the
// threat model. The client's own design intentionally loads the whole roster once
// and does search/calendar grouping client-side for instant UX at this app's real
// scale (an internal team's birthdays); a full pagination rework isn't proportional
// to that design, so instead a hard server-side ceiling replaces "unbounded" with
// "bounded but generous." If this tool ever needs to scale past a few thousand
// people, the client's load-everything model would need to become server-side
// paginated - documented as a residual/roadmap item, not solved in this pass.
const HARD_ROW_CAP = 2000;

/** Wraps an async handler so rejected promises reach the error middleware. */
const wrap = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

/** GET /api/birthdays?q=&month= — list, optionally filtered, capped at HARD_ROW_CAP rows. */
router.get(
  '/',
  wrap(async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    const month = Number(req.query.month);

    const conditions = [];
    const params = [];

    if (q) {
      params.push(`%${q}%`);
      const p = `$${params.length}`;
      conditions.push(`(
        first_name ILIKE ${p}
        OR last_name ILIKE ${p}
        OR (first_name || ' ' || last_name) ILIKE ${p}
        OR coalesce(email, '') ILIKE ${p}
        OR coalesce(phone, '') ILIKE ${p}
      )`);
    }

    if (Number.isInteger(month) && month >= 1 && month <= 12) {
      params.push(month);
      conditions.push(`EXTRACT(MONTH FROM birthdate) = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(HARD_ROW_CAP);
    const capPlaceholder = `$${params.length}`;

    const { rows } = await pool.query(
      `SELECT ${SELECT_COLUMNS}
         FROM birthdays
         ${where}
        ORDER BY EXTRACT(MONTH FROM birthdate),
                 EXTRACT(DAY FROM birthdate),
                 lower(first_name)
        LIMIT ${capPlaceholder}`,
      params,
    );

    res.json(rows.map((row) => decorate(mapRow(row))));
  }),
);

/** GET /api/birthdays/upcoming?days=30 — soonest celebrations first, capped fetch. */
router.get(
  '/upcoming',
  wrap(async (req, res) => {
    const days = Number(req.query.days);
    const window = Number.isFinite(days) && days > 0 ? Math.min(days, 366) : 30;

    const { rows } = await pool.query(
      `SELECT ${SELECT_COLUMNS} FROM birthdays LIMIT $1`,
      [HARD_ROW_CAP],
    );

    const upcoming = rows
      .map((row) => decorate(mapRow(row)))
      .filter((entry) => entry.daysUntil <= window)
      .sort((a, b) => a.daysUntil - b.daysUntil || a.firstName.localeCompare(b.firstName));

    res.json(upcoming);
  }),
);

/** POST /api/birthdays — create a record. */
router.post(
  '/',
  wrap(async (req, res) => {
    const { errors, value } = validateBirthday(req.body);
    if (errors) return res.status(422).json({ errors });

    const { rows } = await pool.query(
      `INSERT INTO birthdays (first_name, last_name, birthdate, phone, email)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${SELECT_COLUMNS}`,
      [value.firstName, value.lastName, value.birthdate, value.phone, value.email],
    );

    res.status(201).json(decorate(mapRow(rows[0])));
  }),
);

/** PUT /api/birthdays/:id — replace a record. */
router.put(
  '/:id',
  wrap(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(404).json({ error: 'Birthday not found.' });
    }

    const { errors, value } = validateBirthday(req.body);
    if (errors) return res.status(422).json({ errors });

    const { rows } = await pool.query(
      `UPDATE birthdays
          SET first_name = $1,
              last_name  = $2,
              birthdate  = $3,
              phone      = $4,
              email      = $5,
              updated_at = now()
        WHERE id = $6
      RETURNING ${SELECT_COLUMNS}`,
      [
        value.firstName,
        value.lastName,
        value.birthdate,
        value.phone,
        value.email,
        req.params.id,
      ],
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Birthday not found.' });
    res.json(decorate(mapRow(rows[0])));
  }),
);

/** DELETE /api/birthdays/:id */
router.delete(
  '/:id',
  wrap(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(404).json({ error: 'Birthday not found.' });
    }

    const { rowCount } = await pool.query('DELETE FROM birthdays WHERE id = $1', [
      req.params.id,
    ]);

    if (rowCount === 0) return res.status(404).json({ error: 'Birthday not found.' });
    res.status(204).end();
  }),
);

export default router;
