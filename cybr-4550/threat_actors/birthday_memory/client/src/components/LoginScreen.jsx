import { useState } from 'react';

/**
 * Domain 1 fix: the app previously had no login screen at all - every visitor
 * saw every teammate's data immediately. This gates the rest of the app behind
 * a real session (see useAuth.js / server/src/auth.js).
 */
export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await onLogin(username.trim(), password);
    if (!result.ok) {
      setError(result.message || 'Invalid username or password.');
    }
    setSubmitting(false);
  }

  return (
    <div className="app">
      <div className="aurora" aria-hidden="true">
        <span className="aurora__blob aurora__blob--1" />
        <span className="aurora__blob aurora__blob--2" />
        <span className="aurora__blob aurora__blob--3" />
        <span className="aurora__grain" />
      </div>

      <main className="container" style={{ maxWidth: 420, paddingTop: '10vh' }}>
        <section className="hero" style={{ textAlign: 'center' }}>
          <p className="hero__kicker">Team access only</p>
          <h1 className="hero__title">
            Sign in to <span className="hero__gradient">Birthday Memory</span>
          </h1>
          <p className="hero__lede">
            This tool holds real teammate contact details, so it's login-gated now.
          </p>
        </section>

        <form className="birthday-form" onSubmit={handleSubmit} noValidate>
          <div className="birthday-form__grid" style={{ gridTemplateColumns: '1fr' }}>
            <label className={`field field--username ${error ? 'field--invalid' : ''}`}>
              <span className="field__label">
                <span aria-hidden="true">👤</span>
                Username
              </span>
              <input
                className="field__input"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoFocus
              />
            </label>

            <label className={`field field--password ${error ? 'field--invalid' : ''}`}>
              <span className="field__label">
                <span aria-hidden="true">🔒</span>
                Password
              </span>
              <input
                className="field__input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <span className="field__error">{error ?? ''}</span>
            </label>
          </div>

          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </main>
    </div>
  );
}
