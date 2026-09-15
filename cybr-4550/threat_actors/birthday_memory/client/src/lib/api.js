const BASE = import.meta.env.VITE_API_URL ?? '';

/** Error carrying per-field validation messages from the API. */
export class ApiError extends Error {
  constructor(message, { status, fieldErrors } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors ?? null;
  }
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new ApiError('Cannot reach the server. Is the API running?');
  }

  if (response.status === 204) return null;

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(body?.error ?? 'The request failed.', {
      status: response.status,
      fieldErrors: body?.errors,
    });
  }

  return body;
}

function query(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const api = {
  list: (params = {}) => request(`/api/birthdays${query(params)}`),
  upcoming: (days = 30) => request(`/api/birthdays/upcoming${query({ days })}`),
  create: (payload) =>
    request('/api/birthdays', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id, payload) =>
    request(`/api/birthdays/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  remove: (id) => request(`/api/birthdays/${id}`, { method: 'DELETE' }),
};
