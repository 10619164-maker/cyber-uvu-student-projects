import { useMemo, useState } from 'react';
import PersonCard from './PersonCard.jsx';
import BirthdayForm from './BirthdayForm.jsx';
import { MONTHS, fullName } from '../lib/utils.js';

const SORTS = [
  { value: 'upcoming', label: 'Soonest birthday' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'age', label: 'Oldest first' },
];

function matches(person, term) {
  if (!term) return true;
  const haystack = [
    person.firstName,
    person.lastName,
    `${person.firstName} ${person.lastName}`,
    person.email ?? '',
    person.phone ?? '',
    person.birthdate,
  ]
    .join(' ')
    .toLowerCase();
  return term
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

/** Search, filter, sort, edit and delete saved birthdays. */
export default function SearchSection({ birthdays, onUpdate, onDelete, onToast }) {
  const [term, setTerm] = useState('');
  const [month, setMonth] = useState('all');
  const [sort, setSort] = useState('upcoming');
  const [editing, setEditing] = useState(null);

  const results = useMemo(() => {
    const filtered = birthdays.filter(
      (person) =>
        matches(person, term.trim()) &&
        (month === 'all' || Number(person.birthdate.slice(5, 7)) === Number(month)),
    );

    const sorted = [...filtered];
    if (sort === 'name') {
      sorted.sort((a, b) => fullName(a).localeCompare(fullName(b)));
    } else if (sort === 'age') {
      sorted.sort((a, b) => b.age - a.age);
    } else {
      sorted.sort((a, b) => a.daysUntil - b.daysUntil);
    }
    return sorted;
  }, [birthdays, term, month, sort]);

  async function handleUpdate(payload) {
    const updated = await onUpdate(editing.id, payload);
    setEditing(null);
    onToast(`${fullName(updated)} updated.`, 'success');
  }

  async function handleDelete(person) {
    const confirmed = window.confirm(`Remove ${fullName(person)} from the birthday list?`);
    if (!confirmed) return;
    try {
      await onDelete(person.id);
      onToast(`${fullName(person)} was removed.`, 'success');
    } catch (error) {
      onToast(error.message, 'error');
    }
  }

  return (
    <section id="search" className="section">
      <header className="section__header">
        <span className="section__eyebrow">02 — Find</span>
        <h2 className="section__title">
          Look up a <em>birthdate</em>
        </h2>
        <p className="section__lede">
          Search across names, emails and phone numbers, then narrow it down by month.
        </p>
      </header>

      <div className="panel panel--search">
        <div className="search-bar">
          <span className="search-bar__icon" aria-hidden="true">
            🔍
          </span>
          <input
            type="search"
            className="search-bar__input"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search by name, email or phone…"
            aria-label="Search birthdays"
          />
          {term && (
            <button
              type="button"
              className="search-bar__clear"
              onClick={() => setTerm('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <div className="filters">
          <div className="filters__group">
            <span className="filters__label">Month</span>
            <div className="pill-row">
              <button
                type="button"
                className={`pill ${month === 'all' ? 'pill--active' : ''}`}
                onClick={() => setMonth('all')}
              >
                All
              </button>
              {MONTHS.map((name, index) => (
                <button
                  key={name}
                  type="button"
                  className={`pill ${Number(month) === index + 1 ? 'pill--active' : ''}`}
                  style={{ '--pill-hue': `${index * 30}` }}
                  onClick={() => setMonth(index + 1)}
                >
                  {name.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          <label className="filters__sort">
            <span className="filters__label">Sort</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="search-count">
          {results.length} {results.length === 1 ? 'match' : 'matches'}
          {term && <> for “{term}”</>}
        </p>

        {results.length === 0 ? (
          <p className="empty">
            <span aria-hidden="true">🫧</span> No birthdays match that search yet.
          </p>
        ) : (
          <div className="results-grid">
            {results.map((person) => (
              <PersonCard
                key={person.id}
                person={person}
                onEdit={setEditing}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {editing && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setEditing(null);
          }}
        >
          <div className="modal" role="dialog" aria-modal="true" aria-label="Edit birthday">
            <header className="modal__header">
              <h3>Edit {fullName(editing)}</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setEditing(null)}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <BirthdayForm
              initial={editing}
              onSubmit={handleUpdate}
              onCancel={() => setEditing(null)}
              submitLabel="Save changes"
            />
          </div>
        </div>
      )}
    </section>
  );
}
