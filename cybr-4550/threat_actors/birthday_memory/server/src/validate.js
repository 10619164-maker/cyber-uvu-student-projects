const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+()\-.\s\d]{7,25}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value) {
  if (!DATE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Validates and normalizes an incoming birthday payload.
 * Returns `{ errors }` when invalid, `{ value }` when valid.
 */
export function validateBirthday(body = {}) {
  const errors = {};

  const firstName = String(body.firstName ?? '').trim();
  const lastName = String(body.lastName ?? '').trim();
  const birthdate = String(body.birthdate ?? '').trim();
  const phone = String(body.phone ?? '').trim();
  const email = String(body.email ?? '').trim();

  if (!firstName) errors.firstName = 'First name is required.';
  else if (firstName.length > 80) errors.firstName = 'First name is too long.';

  if (!lastName) errors.lastName = 'Last name is required.';
  else if (lastName.length > 80) errors.lastName = 'Last name is too long.';

  if (!birthdate) {
    errors.birthdate = 'Birthdate is required.';
  } else if (!isRealDate(birthdate)) {
    errors.birthdate = 'Birthdate must be a valid YYYY-MM-DD date.';
  } else if (birthdate > new Date().toISOString().slice(0, 10)) {
    errors.birthdate = 'Birthdate cannot be in the future.';
  }

  if (phone && !PHONE_RE.test(phone)) {
    errors.phone = 'Telephone number looks invalid.';
  }

  if (email && !EMAIL_RE.test(email)) {
    errors.email = 'Email address looks invalid.';
  }

  if (Object.keys(errors).length > 0) return { errors };

  return {
    value: {
      firstName,
      lastName,
      birthdate,
      phone: phone || null,
      email: email || null,
    },
  };
}
