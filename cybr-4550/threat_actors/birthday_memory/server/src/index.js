// Startup entry point (npm run dev / npm start). Always starts the real server -
// unconditionally, no "am I the main module" guard needed, because the app definition
// itself lives in ./app.js with zero import-time side effects. The Supertest regression
// suite imports from app.js directly and never touches this file.
import 'dotenv/config';
import { app } from './app.js';
import { initSchema } from './db.js';

const PORT = Number(process.env.PORT ?? 4000);

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
