import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initSchema, pool } from './db.js';
import birthdaysRouter from './routes.js';

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'thebirthdates' });
  } catch (error) {
    res.status(503).json({ status: 'degraded', error: error.message });
  }
});

app.use('/api/birthdays', birthdaysRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// eslint-disable-next-line no-unused-vars -- Express identifies error middleware by arity.
app.use((error, _req, res, _next) => {
  console.error('[api]', error);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

async function start() {
  try {
    await initSchema();
    console.log('[db] schema ready on "thebirthdates"');
  } catch (error) {
    console.error('[db] could not initialize schema:', error.message);
    console.error('[db] is Postgres running? Try: npm run db:up');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`[api] listening on http://localhost:${PORT}`);
  });
}

start();
