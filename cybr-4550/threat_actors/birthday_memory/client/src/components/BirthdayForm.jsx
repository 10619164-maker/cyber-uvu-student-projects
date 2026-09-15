import { useEffect, useState } from 'react';
import { todayISO } from '../lib/utils.js';

const EMPTY = {
  firstName: '',
  lastName: '',
  birthdate: '',
  phone: '',
  email: '',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+()\-.\s\d]{7,25}$/;

function validate(values) {
  const errors = {};
  if (!values.firstName.trim()) errors.firstName = 'First name is required.';
  if (!values.lastName.trim()) errors.lastName = 'Last name is required.';

  if (!values.birthdate) errors.birthdate = 'Birthdate is required.';
  else if (values.birthdate > todayISO()) errors.birthdate = 'That date is in the future.';

  if (values.phone.trim() && !PHONE_RE.test(values.phone.trim())) {
    errors.phone = 'Use digits, spaces, +, - or parentheses.';
  }
  if (values.email.trim() && !EMAIL_RE.test(values.email.trim())) {
    errors.email = 'That email address looks off.';
  }
  return errors;
}

const FIELDS = [
  { name: 'firstName', label: 'First name', type: 'text', placeholder: 'Ada', icon: '🙂', autoComplete: 'given-name' },
  { name: 'lastName', label: 'Last name', type: 'text', placeholder: 'Lovelace', icon: '🏷️', autoComplete: 'family-name' },
  { name: 'birthdate', label: 'Birthdate', type: 'date', placeholder: '', icon: '🎂', autoComplete: 'bday' },
  { name: 'phone', label: 'Telephone number', type: 'tel', placeholder: '+1 415 555 0101', icon: '📞', autoComplete: 'tel' },
  { name: 'email', label: 'Email address', type: 'email', placeholder: 'ada@example.com', icon: '✉️', autoComplete: 'email' },
];

/**
 * Collects the five birthday fields. Doubles as the edit form when `initial`
 * is provided; `onSubmit` receives the trimmed payload.
 */
export default function BirthdayForm({ initial, onSubmit, onCancel, submitLabel = 'Save birthday' }) {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    setValues(
      initial
        ? {
            firstName: initial.firstName ?? '',
            lastName: initial.lastName ?? '',
            birthdate: initial.birthdate?.slice(0, 10) ?? '',
            phone: initial.phone ?? '',
            email: initial.email ?? '',
          }
        : EMPTY,
    );
    setErrors({});
    setTouched({});
    setFormError(null);
  }, [initial]);

  const setField = (name) => (event) => {
    const next = { ...values, [name]: event.target.value };
    setValues(next);
    if (touched[name]) setErrors(validate(next));
  };

  const blurField = (name) => () => {
    setTouched((current) => ({ ...current, [name]: true }));
    setErrors(validate(values));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    const found = validate(values);
    setErrors(found);
    setTouched(Object.fromEntries(FIELDS.map((field) => [field.name, true])));
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await onSubmit({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        birthdate: values.birthdate,
        phone: values.phone.trim(),
        email: values.email.trim(),
      });
      if (!initial) {
        setValues(EMPTY);
        setTouched({});
      }
    } catch (error) {
      if (error.fieldErrors) setErrors(error.fieldErrors);
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="birthday-form" onSubmit={handleSubmit} noValidate>
      <div className="birthday-form__grid">
        {FIELDS.map((field) => {
          const invalid = Boolean(errors[field.name]);
          return (
            <label
              key={field.name}
              className={`field field--${field.name} ${invalid ? 'field--invalid' : ''}`}
            >
              <span className="field__label">
                <span aria-hidden="true">{field.icon}</span>
                {field.label}
                {['firstName', 'lastName', 'birthdate'].includes(field.name) && (
                  <span className="field__required" aria-hidden="true">
                    *
                  </span>
                )}
              </span>
              <input
                className="field__input"
                type={field.type}
                value={values[field.name]}
                placeholder={field.placeholder}
                autoComplete={field.autoComplete}
                max={field.type === 'date' ? todayISO() : undefined}
                aria-invalid={invalid}
                onChange={setField(field.name)}
                onBlur={blurField(field.name)}
              />
              <span className="field__error">{errors[field.name] ?? ''}</span>
            </label>
          );
        })}
      </div>

      {formError && <p className="birthday-form__alert">{formError}</p>}

      <div className="birthday-form__actions">
        {onCancel && (
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
          <span aria-hidden="true">🎈</span>
        </button>
      </div>
    </form>
  );
}
