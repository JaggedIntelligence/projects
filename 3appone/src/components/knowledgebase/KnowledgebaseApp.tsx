import { useEffect, useMemo, useState, type FormEvent } from 'react';

type Entry = {
  id: number;
  catlevel1: string;
  catlevel2: string | null;
  url1: string;
  url2: string | null;
  note1: string | null;
  note2: string | null;
  createdAt: string;
  updatedAt: string;
};

type FormValues = Pick<Entry, 'catlevel1' | 'url1'> & {
  catlevel2: string;
  url2: string;
  note1: string;
  note2: string;
};

const emptyForm: FormValues = { catlevel1: '', catlevel2: '', url1: '', url2: '', note1: '', note2: '' };

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Something went wrong.');
  return result as T;
}

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function safeHref(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function linkLabel(value: string) {
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, '') + (url.pathname !== '/' ? url.pathname.replace(/\/$/, '') : '');
  } catch {
    return value;
  }
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function EntryLink({ value, secondary = false }: { value: string; secondary?: boolean }) {
  const href = safeHref(value);
  return href ? (
    <a className={secondary ? 'kb-link kb-link-secondary' : 'kb-link'} href={href} target="_blank" rel="noopener noreferrer" title={value}>
      <span>{linkLabel(value)}</span><span aria-hidden="true">↗</span>
    </a>
  ) : <span className="kb-link kb-link-invalid" title={value}>{value}</span>;
}

export default function KnowledgebaseApp() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [editor, setEditor] = useState<Entry | 'new' | null>(null);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Entry | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadEntries() {
    setLoading(true);
    setError('');
    try {
      setEntries(await api<Entry[]>('/api/knowledgebase'));
    } catch (cause) {
      setError(errorMessage(cause, 'Could not load entries.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadEntries(); }, []);

  const categories = useMemo(() =>
    [...new Set(entries.map((entry) => entry.catlevel1))].sort((a, b) => a.localeCompare(b)), [entries]);

  const visibleEntries = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return entries.filter((entry) => {
      if (category !== 'all' && entry.catlevel1 !== category) return false;
      if (!term) return true;
      return [entry.catlevel1, entry.catlevel2, entry.url1, entry.url2, entry.note1, entry.note2]
        .some((value) => value?.toLocaleLowerCase().includes(term));
    });
  }, [entries, query, category]);

  function openEditor(entry: Entry | 'new') {
    setEditor(entry);
    setForm(entry === 'new' ? { ...emptyForm } : {
      catlevel1: entry.catlevel1,
      catlevel2: entry.catlevel2 ?? '',
      url1: entry.url1,
      url2: entry.url2 ?? '',
      note1: entry.note1 ?? '',
      note2: entry.note2 ?? '',
    });
    setFormError('');
  }

  function changeField(field: keyof FormValues, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || saving) return;
    const payload = {
      catlevel1: form.catlevel1.trim(),
      catlevel2: form.catlevel2.trim() || null,
      url1: form.url1.trim(),
      url2: form.url2.trim() || null,
      note1: form.note1.trim() || null,
      note2: form.note2.trim() || null,
    };
    if (!payload.catlevel1 || !payload.url1) {
      setFormError('Category and primary URL are required.');
      return;
    }
    if (!safeHref(payload.url1) || (payload.url2 && !safeHref(payload.url2))) {
      setFormError('Enter a full http:// or https:// URL.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const entry = await api<Entry>(editor === 'new' ? '/api/knowledgebase' : `/api/knowledgebase/${editor.id}`, {
        method: editor === 'new' ? 'POST' : 'PATCH',
        body: JSON.stringify(payload),
      });
      setEntries((current) => editor === 'new' ? [entry, ...current] : current.map((item) => item.id === entry.id ? entry : item));
      setCategory('all');
      setQuery('');
      setEditor(null);
    } catch (cause) {
      setFormError(errorMessage(cause, 'Could not save entry.'));
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setError('');
    try {
      await api<{ id: number }>(`/api/knowledgebase/${deleteTarget.id}`, { method: 'DELETE' });
      setEntries((current) => current.filter((entry) => entry.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (cause) {
      setError(errorMessage(cause, 'Could not delete entry.'));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="kb-page">
      <div className="kb-wrap">
        <header className="kb-header">
          <div>
            <p className="kb-eyebrow">YOUR WORKSPACE / KNOWLEDGEBASE</p>
            <h1>Keep the good answers close.</h1>
            <p className="kb-intro">A clear home for useful links, categories, and the notes you want to remember.</p>
          </div>
          <button className="kb-primary kb-new" type="button" onClick={() => openEditor('new')}><span aria-hidden="true">＋</span> New entry</button>
        </header>

        <section className="kb-panel" aria-label="Knowledgebase entries">
          <div className="kb-panel-top">
            <div className="kb-panel-title"><span className="kb-panel-icon" aria-hidden="true">▤</span><div><h2>Saved knowledge</h2><p>{entries.length} {entries.length === 1 ? 'entry' : 'entries'} in your library</p></div></div>
            <span className="kb-count">{visibleEntries.length} shown</span>
          </div>

          <div className="kb-controls">
            <label className="kb-search">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m16 16 5 5" /></svg>
              <span className="kb-sr-only">Search entries</span>
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search links, notes, categories…" />
            </label>
            <label className="kb-filter"><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          </div>

          {error && <div className="kb-error" role="alert">{error}<button type="button" onClick={() => void loadEntries()}>Retry</button></div>}

          {loading ? <div className="kb-empty" role="status">Loading your knowledgebase…</div> : visibleEntries.length === 0 ? (
            <div className="kb-empty"><div className="kb-empty-icon" aria-hidden="true">✳</div><h3>{entries.length === 0 ? 'Your library starts here.' : 'No matching entries.'}</h3><p>{entries.length === 0 ? 'Save a useful link and the context that goes with it.' : 'Try a different search or category.'}</p>{entries.length === 0 && <button className="kb-primary" type="button" onClick={() => openEditor('new')}>Add your first entry</button>}</div>
          ) : (
            <div className="kb-table-scroll"><table className="kb-table"><thead><tr><th scope="col">Category</th><th scope="col">Links</th><th scope="col">Notes</th><th scope="col">Added</th><th scope="col"><span className="kb-sr-only">Actions</span></th></tr></thead><tbody>
              {visibleEntries.map((entry) => <tr key={entry.id}>
                <td><div className="kb-category"><strong>{entry.catlevel1}</strong>{entry.catlevel2 && <span>{entry.catlevel2}</span>}</div></td>
                <td><div className="kb-links"><EntryLink value={entry.url1} />{entry.url2 && <EntryLink value={entry.url2} secondary />}</div></td>
                <td><div className="kb-notes">{entry.note1 && <span title={entry.note1}>{entry.note1}</span>}{entry.note2 && <span className="kb-note-two" title={entry.note2}>{entry.note2}</span>}{!entry.note1 && !entry.note2 && <span className="kb-muted">No notes</span>}</div></td>
                <td className="kb-date"><time dateTime={entry.createdAt}>{dateLabel(entry.createdAt)}</time></td>
                <td><div className="kb-row-actions"><button type="button" onClick={() => openEditor(entry)} aria-label={`Edit ${entry.catlevel1} entry`}>Edit</button><button className="kb-delete-button" type="button" onClick={() => setDeleteTarget(entry)} aria-label={`Delete ${entry.catlevel1} entry`}>Delete</button></div></td>
              </tr>)}
            </tbody></table></div>
          )}
        </section>
        <p className="kb-footnote">Make it easy to find what you have already learned.</p>
      </div>

      {editor && <div className="kb-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditor(null); }}>
        <section className="kb-drawer" role="dialog" aria-modal="true" aria-labelledby="kb-editor-title" onKeyDown={(event) => { if (event.key === 'Escape' && !saving) setEditor(null); }}>
          <div className="kb-drawer-header"><div><p className="kb-eyebrow">KNOWLEDGEBASE / {editor === 'new' ? 'NEW ENTRY' : 'EDIT ENTRY'}</p><h2 id="kb-editor-title">{editor === 'new' ? 'Save something useful' : 'Edit this entry'}</h2><p>Keep the link and the context together.</p></div><button className="kb-close" type="button" aria-label="Close editor" disabled={saving} onClick={() => setEditor(null)}>×</button></div>
          <form className="kb-form" onSubmit={(event) => void saveEntry(event)}>
            <div className="kb-form-body">
              <div className="kb-form-section">ORGANIZE</div>
              <div className="kb-form-grid"><label>Primary category <span>*</span><input autoFocus required value={form.catlevel1} onChange={(event) => changeField('catlevel1', event.target.value)} placeholder="e.g. Research" /></label><label>Subcategory<input value={form.catlevel2} onChange={(event) => changeField('catlevel2', event.target.value)} placeholder="e.g. AI tools" /></label></div>
              <div className="kb-form-section">LINKS</div>
              <label>Primary URL <span>*</span><input required type="url" value={form.url1} onChange={(event) => changeField('url1', event.target.value)} placeholder="https://…" /></label>
              <label>Secondary URL<input type="url" value={form.url2} onChange={(event) => changeField('url2', event.target.value)} placeholder="https://…" /></label>
              <div className="kb-form-section">YOUR NOTES</div>
              <label>Note 1<textarea rows={3} value={form.note1} onChange={(event) => changeField('note1', event.target.value)} placeholder="What is worth remembering?" /></label>
              <label>Note 2<textarea rows={3} value={form.note2} onChange={(event) => changeField('note2', event.target.value)} placeholder="Add more context…" /></label>
              {formError && <p className="kb-form-error" role="alert">{formError}</p>}
            </div>
            <div className="kb-form-footer"><button className="kb-secondary" type="button" disabled={saving} onClick={() => setEditor(null)}>Cancel</button><button className="kb-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : editor === 'new' ? 'Save entry' : 'Save changes'}</button></div>
          </form>
        </section>
      </div>}

      {deleteTarget && <div className="kb-overlay kb-confirm-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setDeleteTarget(null); }}><section className="kb-confirm" role="alertdialog" aria-modal="true" aria-labelledby="kb-confirm-title" aria-describedby="kb-confirm-description" onKeyDown={(event) => { if (event.key === 'Escape' && !deleting) setDeleteTarget(null); }}><span className="kb-confirm-icon" aria-hidden="true">×</span><h2 id="kb-confirm-title">Delete this entry?</h2><p id="kb-confirm-description">The links and notes in <strong>{deleteTarget.catlevel1}</strong> will be removed.</p><div><button className="kb-secondary" type="button" autoFocus disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</button><button className="kb-danger" type="button" disabled={deleting} onClick={() => void deleteEntry()}>{deleting ? 'Deleting…' : 'Delete entry'}</button></div></section></div>}
    </main>
  );
}
