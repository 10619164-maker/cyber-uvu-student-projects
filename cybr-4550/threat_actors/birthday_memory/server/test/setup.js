// Runs once before the test suite (see vitest.config.js's setupFiles).
//
// Test files import app.js directly, not index.js - and app.js is deliberately
// side-effect-free on import (no dotenv loading, no port binding) so it's safe for the
// regression suite to import. That means nothing else loads server/.env when running
// tests, so tests that need real config (auth.test.js needs JWT_SECRET/PGUSER/PGPASSWORD/
// CLIENT_ORIGIN to actually connect and sign tokens) would otherwise silently run against
// an empty environment. This is that missing piece, applied globally instead of
// duplicated at the top of every test file.
import 'dotenv/config';
