import {
  countdownLabel,
  formatLongDate,
  fullName,
  gradientFor,
  initials,
} from '../lib/utils.js';

/** A colorful summary card for one person, with optional edit/delete actions. */
export default function PersonCard({ person, onEdit, onDelete, compact = false }) {
  const gradient = gradientFor(person);
  const isToday = person.daysUntil === 0;

  return (
    <article
      className={`person-card ${compact ? 'person-card--compact' : ''} ${
        isToday ? 'person-card--today' : ''
      }`}
      style={{ '--card-from': gradient.from, '--card-to': gradient.to }}
    >
      <div className="person-card__avatar" style={{ backgroundImage: gradient.css }}>
        {initials(person)}
      </div>

      <div className="person-card__body">
        <header className="person-card__header">
          <h3 className="person-card__name">{fullName(person)}</h3>
          <span className={`chip ${isToday ? 'chip--party' : ''}`}>
            {countdownLabel(person.daysUntil)}
          </span>
        </header>

        <p className="person-card__date">
          <span aria-hidden="true">🎂</span> {formatLongDate(person.birthdate)}
          <span className="person-card__age">turning {person.turningAge}</span>
        </p>

        {!compact && (person.phone || person.email) && (
          <ul className="person-card__contact">
            {person.phone && (
              <li>
                <span aria-hidden="true">📞</span>
                <a href={`tel:${person.phone.replace(/\s+/g, '')}`}>{person.phone}</a>
              </li>
            )}
            {person.email && (
              <li>
                <span aria-hidden="true">✉️</span>
                <a href={`mailto:${person.email}`}>{person.email}</a>
              </li>
            )}
          </ul>
        )}
      </div>

      {(onEdit || onDelete) && (
        <div className="person-card__actions">
          {onEdit && (
            <button
              type="button"
              className="icon-btn"
              onClick={() => onEdit(person)}
              aria-label={`Edit ${fullName(person)}`}
              title="Edit"
            >
              ✎
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="icon-btn icon-btn--danger"
              onClick={() => onDelete(person)}
              aria-label={`Delete ${fullName(person)}`}
              title="Delete"
            >
              🗑
            </button>
          )}
        </div>
      )}
    </article>
  );
}
