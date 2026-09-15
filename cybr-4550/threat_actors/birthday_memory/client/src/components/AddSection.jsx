import BirthdayForm from './BirthdayForm.jsx';
import PersonCard from './PersonCard.jsx';
import { fullName } from '../lib/utils.js';

/** "Add a birthday" panel plus a live preview of the newest entries. */
export default function AddSection({ recent, onCreate, onToast }) {
  async function handleCreate(payload) {
    const created = await onCreate(payload);
    onToast(`${fullName(created)} joined the party!`, 'success');
  }

  return (
    <section id="add" className="section">
      <header className="section__header">
        <span className="section__eyebrow">01 — Collect</span>
        <h2 className="section__title">
          Add a <em>birthday</em>
        </h2>
        <p className="section__lede">
          Five quick fields and it is saved to the <code>thebirthdates</code> database forever.
        </p>
      </header>

      <div className="add-layout">
        <div className="panel panel--form">
          <BirthdayForm onSubmit={handleCreate} submitLabel="Save birthday" />
        </div>

        <aside className="panel panel--recent">
          <h3 className="panel__title">Just added</h3>
          {recent.length === 0 ? (
            <p className="empty empty--small">
              Nothing here yet. Your first birthday will show up right away.
            </p>
          ) : (
            <div className="stack">
              {recent.map((person) => (
                <PersonCard key={person.id} person={person} compact />
              ))}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
