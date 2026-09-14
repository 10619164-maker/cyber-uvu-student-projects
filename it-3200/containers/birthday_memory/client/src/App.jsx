import { useEffect, useMemo, useState } from 'react';
import AddSection from './components/AddSection.jsx';
import SearchSection from './components/SearchSection.jsx';
import CalendarSection from './components/CalendarSection.jsx';
import { Toast, useToast } from './components/Toast.jsx';
import { useBirthdays } from './hooks/useBirthdays.js';
import { fullName } from './lib/utils.js';

const NAV = [
  { id: 'add', label: 'Add', emoji: '✨' },
  { id: 'search', label: 'Search', emoji: '🔍' },
  { id: 'calendar', label: 'Calendar', emoji: '📆' },
];

export default function App() {
  const { birthdays, loading, error, refresh, create, update, remove } = useBirthdays();
  const { toast, show, dismiss } = useToast();
  const [active, setActive] = useState('add');

  // Highlight the nav item for whichever section is closest to the viewport top.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: '-25% 0px -60% 0px', threshold: [0.1, 0.5, 1] },
    );

    for (const item of NAV) {
      const element = document.getElementById(item.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [loading]);

  const stats = useMemo(() => {
    const todayList = birthdays.filter((person) => person.daysUntil === 0);
    const thisMonth = birthdays.filter(
      (person) => Number(person.birthdate.slice(5, 7)) === new Date().getMonth() + 1,
    );
    const next = [...birthdays].sort((a, b) => a.daysUntil - b.daysUntil)[0];
    return { total: birthdays.length, todayList, thisMonth: thisMonth.length, next };
  }, [birthdays]);

  const recent = useMemo(
    () =>
      [...birthdays]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 3),
    [birthdays],
  );

  return (
    <div className="app">
      <div className="aurora" aria-hidden="true">
        <span className="aurora__blob aurora__blob--1" />
        <span className="aurora__blob aurora__blob--2" />
        <span className="aurora__blob aurora__blob--3" />
        <span className="aurora__grain" />
      </div>

      <header className="topbar">
        <a className="brand" href="#add">
          <span className="brand__mark" aria-hidden="true">
            🎂
          </span>
          <span className="brand__text">
            Birthday<span>Memory</span>
          </span>
        </a>
        <nav className="nav" aria-label="Sections">
          {NAV.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`nav__link ${active === item.id ? 'nav__link--active' : ''}`}
            >
              <span aria-hidden="true">{item.emoji}</span>
              {item.label}
            </a>
          ))}
        </nav>
      </header>

      <main className="container">
        <section className="hero">
          <p className="hero__kicker">Never miss a candle again</p>
          <h1 className="hero__title">
            Every birthday you care about,
            <br />
            <span className="hero__gradient">in one glowing place.</span>
          </h1>
          <p className="hero__lede">
            Save names, dates and contact details, search them in a heartbeat, and watch the
            year light up on a calendar built for celebrating.
          </p>

          <div className="stats">
            <div className="stat">
              <span className="stat__value">{stats.total}</span>
              <span className="stat__label">saved birthdays</span>
            </div>
            <div className="stat stat--accent">
              <span className="stat__value">{stats.todayList.length}</span>
              <span className="stat__label">celebrating today</span>
            </div>
            <div className="stat">
              <span className="stat__value">{stats.thisMonth}</span>
              <span className="stat__label">this month</span>
            </div>
            <div className="stat stat--wide">
              <span className="stat__value stat__value--small">
                {stats.next ? fullName(stats.next) : '—'}
              </span>
              <span className="stat__label">
                {stats.next
                  ? stats.next.daysUntil === 0
                    ? 'is celebrating right now'
                    : `is next, in ${stats.next.daysUntil} days`
                  : 'no birthdays yet'}
              </span>
            </div>
          </div>

          {stats.todayList.length > 0 && (
            <div className="banner">
              <span aria-hidden="true">🎉</span>
              <p>
                {stats.todayList.map((person) => fullName(person)).join(', ')}{' '}
                {stats.todayList.length === 1 ? 'is' : 'are'} celebrating today — send some love!
              </p>
            </div>
          )}
        </section>

        {error && (
          <div className="alert">
            <p>{error}</p>
            <button type="button" className="btn btn--ghost btn--small" onClick={refresh}>
              Try again
            </button>
          </div>
        )}

        {loading ? (
          <div className="loader">
            <span className="loader__ring" aria-hidden="true" />
            <p>Unwrapping your birthdays…</p>
          </div>
        ) : (
          <>
            <AddSection recent={recent} onCreate={create} onToast={show} />
            <SearchSection
              birthdays={birthdays}
              onUpdate={update}
              onDelete={remove}
              onToast={show}
            />
            <CalendarSection birthdays={birthdays} />
          </>
        )}
      </main>

      <footer className="footer">
        <p>
          Data lives in the <code>thebirthdates</code> Postgres database.
        </p>
      </footer>

      <Toast toast={toast} onDismiss={dismiss} />
    </div>
  );
}
