import { useMemo, useState } from 'react';
import PersonCard from './PersonCard.jsx';
import {
  MONTHS,
  WEEKDAYS,
  buildMonthGrid,
  fullName,
  gradientFor,
  groupByMonthDay,
  initials,
  todayISO,
} from '../lib/utils.js';

/** Month grid of birthdays plus an upcoming-celebrations rail. */
export default function CalendarSection({ birthdays }) {
  const today = todayISO();
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selected, setSelected] = useState(null);

  const byMonthDay = useMemo(() => groupByMonthDay(birthdays), [birthdays]);
  const cells = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  );

  const monthCount = useMemo(
    () =>
      birthdays.filter((person) => Number(person.birthdate.slice(5, 7)) === cursor.month + 1)
        .length,
    [birthdays, cursor.month],
  );

  const upcoming = useMemo(
    () => [...birthdays].sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 5),
    [birthdays],
  );

  function shiftMonth(delta) {
    setSelected(null);
    setCursor((current) => {
      const date = new Date(Date.UTC(current.year, current.month + delta, 1));
      return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
    });
  }

  function jumpToToday() {
    setSelected(null);
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
  }

  const selectedPeople = selected ? (byMonthDay.get(selected.slice(5, 10)) ?? []) : [];

  return (
    <section id="calendar" className="section">
      <header className="section__header">
        <span className="section__eyebrow">03 — Celebrate</span>
        <h2 className="section__title">
          The birthday <em>calendar</em>
        </h2>
        <p className="section__lede">
          Every saved birthdate, laid out month by month. Tap a glowing day to see who is
          celebrating.
        </p>
      </header>

      <div className="calendar-layout">
        <div className="panel panel--calendar">
          <div className="calendar__toolbar">
            <button
              type="button"
              className="icon-btn icon-btn--nav"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
            >
              ‹
            </button>
            <div className="calendar__heading">
              <h3>
                {MONTHS[cursor.month]} <span>{cursor.year}</span>
              </h3>
              <p>
                {monthCount} {monthCount === 1 ? 'birthday' : 'birthdays'} this month
              </p>
            </div>
            <button
              type="button"
              className="icon-btn icon-btn--nav"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <button type="button" className="btn btn--ghost btn--small" onClick={jumpToToday}>
            Jump to today
          </button>

          <div className="calendar__weekdays" aria-hidden="true">
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="calendar__grid" role="grid">
            {cells.map((cell) => {
              const people = byMonthDay.get(cell.iso.slice(5, 10)) ?? [];
              const isToday = cell.iso === today;
              const isSelected = cell.iso === selected;
              const hasPeople = cell.inMonth && people.length > 0;

              return (
                <button
                  key={cell.iso}
                  type="button"
                  role="gridcell"
                  disabled={!cell.inMonth}
                  onClick={() => setSelected(isSelected ? null : cell.iso)}
                  className={[
                    'day',
                    cell.inMonth ? '' : 'day--muted',
                    isToday ? 'day--today' : '',
                    isSelected ? 'day--selected' : '',
                    hasPeople ? 'day--party' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-label={
                    hasPeople
                      ? `${MONTHS[cell.month]} ${cell.day}: ${people
                          .map((person) => fullName(person))
                          .join(', ')}`
                      : `${MONTHS[cell.month]} ${cell.day}`
                  }
                >
                  <span className="day__number">{cell.day}</span>
                  {hasPeople && (
                    <span className="day__people">
                      {people.slice(0, 3).map((person) => (
                        <span
                          key={person.id}
                          className="day__dot"
                          style={{ backgroundImage: gradientFor(person).css }}
                          title={fullName(person)}
                        >
                          {initials(person)}
                        </span>
                      ))}
                      {people.length > 3 && (
                        <span className="day__more">+{people.length - 3}</span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="calendar__details">
              <h4>
                {MONTHS[Number(selected.slice(5, 7)) - 1]} {Number(selected.slice(8, 10))}
              </h4>
              {selectedPeople.length === 0 ? (
                <p className="empty empty--small">No birthdays on this day.</p>
              ) : (
                <div className="stack">
                  {selectedPeople.map((person) => (
                    <PersonCard key={person.id} person={person} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="panel panel--upcoming">
          <h3 className="panel__title">Coming up next</h3>
          {upcoming.length === 0 ? (
            <p className="empty empty--small">Add a birthday to start the countdown.</p>
          ) : (
            <ol className="timeline">
              {upcoming.map((person) => {
                const gradient = gradientFor(person);
                return (
                  <li key={person.id} className="timeline__item">
                    <span
                      className="timeline__marker"
                      style={{ backgroundImage: gradient.css }}
                      aria-hidden="true"
                    />
                    <div>
                      <p className="timeline__name">{fullName(person)}</p>
                      <p className="timeline__meta">
                        {MONTHS[Number(person.birthdate.slice(5, 7)) - 1].slice(0, 3)}{' '}
                        {Number(person.birthdate.slice(8, 10))} · turning {person.turningAge}
                      </p>
                    </div>
                    <span className="timeline__days">
                      {person.daysUntil === 0 ? 'today' : `${person.daysUntil}d`}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </aside>
      </div>
    </section>
  );
}
