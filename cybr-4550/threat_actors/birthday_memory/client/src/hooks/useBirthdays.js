import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';

/**
 * Loads every birthday once and keeps the local cache in sync after writes.
 * Searching and calendar grouping happen client-side against this cache, which
 * keeps the UI instant for the dataset sizes this app targets.
 */
export function useBirthdays() {
  const [birthdays, setBirthdays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.list();
      setBirthdays(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(async (payload) => {
    const created = await api.create(payload);
    setBirthdays((current) => sortByCelebration([...current, created]));
    return created;
  }, []);

  const update = useCallback(async (id, payload) => {
    const updated = await api.update(id, payload);
    setBirthdays((current) =>
      sortByCelebration(current.map((entry) => (entry.id === id ? updated : entry))),
    );
    return updated;
  }, []);

  const remove = useCallback(async (id) => {
    await api.remove(id);
    setBirthdays((current) => current.filter((entry) => entry.id !== id));
  }, []);

  return { birthdays, loading, error, refresh, create, update, remove };
}

function sortByCelebration(list) {
  return [...list].sort((a, b) => {
    const aKey = a.birthdate.slice(5);
    const bKey = b.birthdate.slice(5);
    return aKey.localeCompare(bKey) || a.firstName.localeCompare(b.firstName);
  });
}
