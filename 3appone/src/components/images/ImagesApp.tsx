import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';

const USER_ID = 'user1';
const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

type ImageItem = { id: string; userId: string; fileName: string; originalName: string; desc: string | null; contentType: string; size: number; width: number | null; height: number | null; createdAt: string; updatedAt: string; contentUrl: string };
type ImagePage = { items: ImageItem[]; nextCursor: string | null };
type Upload = { id: string; file: File; state: 'waiting' | 'uploading' | 'done' | 'error'; progress: number; error?: string };

async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...options, headers: { 'X-Image-User-Id': USER_ID, ...options.headers } });
  if (response.status === 204) return undefined as T;
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Request failed.');
  return result as T;
}

function uploadFile(file: File, onProgress: (progress: number) => void): Promise<ImageItem> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/images');
    xhr.setRequestHeader('X-Image-User-Id', USER_ID);
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
    xhr.onerror = () => reject(new Error('Network error during upload.'));
    xhr.onload = () => {
      let result: any;
      try { result = JSON.parse(xhr.responseText); } catch { result = {}; }
      if (xhr.status >= 200 && xhr.status < 300) resolve(result as ImageItem);
      else reject(new Error(result.error ?? 'Upload failed.'));
    };
    const form = new FormData();
    form.set('file', file);
    xhr.send(form);
  });
}

const message = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong.';
const date = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
const size = (bytes: number) => bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export default function ImagesApp() {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [moreLoading, setMoreLoading] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [selected, setSelected] = useState<ImageItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const modalClose = useRef<HTMLButtonElement>(null);

  async function load(term = search, next?: string | null) {
    if (next) setMoreLoading(true); else { setLoading(true); setError(''); }
    try {
      const params = new URLSearchParams();
      if (term) params.set('q', term);
      if (next) params.set('cursor', next);
      const page = await api<ImagePage>(`/api/images?${params}`);
      setItems((old) => next ? [...old, ...page.items] : page.items);
      setCursor(page.nextCursor);
    } catch (cause) { setError(message(cause)); }
    finally { setLoading(false); setMoreLoading(false); }
  }

  useEffect(() => { void load(''); }, []);
  useEffect(() => {
    if (!selected) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modalClose.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) setSelected(null); };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus(); };
  }, [selected?.id]);

  function enqueue(files: FileList | File[]) {
    const incoming = Array.from(files).map((file) => ({ id: crypto.randomUUID(), file, state: 'waiting' as const, progress: 0 }));
    setUploads((old) => [...incoming, ...old]);
    for (const entry of incoming) void startUpload(entry);
  }

  function updateUpload(id: string, patch: Partial<Upload>) {
    setUploads((old) => old.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));
  }

  async function startUpload(entry: Upload) {
    if (!TYPES.has(entry.file.type) || entry.file.size === 0 || entry.file.size > MAX_BYTES) {
      updateUpload(entry.id, { state: 'error', error: 'Use a JPEG, PNG, WebP, or GIF under 10 MiB.' });
      return;
    }
    updateUpload(entry.id, { state: 'uploading', progress: 0, error: undefined });
    try {
      const item = await uploadFile(entry.file, (progress) => updateUpload(entry.id, { progress }));
      updateUpload(entry.id, { state: 'done', progress: 100 });
      if (!search) setItems((old) => [item, ...old.filter((existing) => existing.id !== item.id)]);
      else void load(search);
    } catch (cause) { updateUpload(entry.id, { state: 'error', error: message(cause) }); }
  }

  function open(item: ImageItem) {
    setSelected(item); setName(item.fileName); setDescription(item.desc ?? ''); setEditing(false); setDialogError('');
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true); setDialogError('');
    try {
      const changed = await api<ImageItem>(`/api/images/${selected.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: name, desc: description }) });
      setItems((old) => old.map((item) => item.id === changed.id ? changed : item));
      setSelected(changed); setEditing(false);
    } catch (cause) { setDialogError(message(cause)); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!selected || !window.confirm(`Delete “${selected.fileName}”? This cannot be undone.`)) return;
    setBusy(true); setDialogError('');
    try {
      await api<void>(`/api/images/${selected.id}`, { method: 'DELETE' });
      setItems((old) => old.filter((item) => item.id !== selected.id));
      setSelected(null);
    } catch (cause) { setDialogError(message(cause)); }
    finally { setBusy(false); }
  }

  function onFiles(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files?.length) enqueue(event.target.files);
    event.target.value = '';
  }
  function onDrop(event: DragEvent) { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length) enqueue(event.dataTransfer.files); }

  return <main className="images-page">
    <div className="images-wrap">
      <header className="images-header"><div><p className="images-kicker">YOUR LIBRARY</p><h1>Images</h1><p>Upload, find, and organize your images.</p></div><button className="images-primary" onClick={() => fileInput.current?.click()}>+ Upload images</button></header>
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={onFiles} aria-label="Choose images to upload" />
      <section className={`images-drop ${dragging ? 'is-dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop} aria-label="Image upload area">
        <div className="images-drop-icon" aria-hidden="true">↥</div><div><strong>Drop images here</strong><span>or choose files to upload · JPEG, PNG, WebP, GIF · 10 MiB max each</span></div><button className="images-secondary" onClick={() => fileInput.current?.click()}>Choose files</button>
      </section>
      {uploads.length > 0 && <section className="images-uploads" aria-label="Uploads"><div className="images-section-heading"><h2>Uploads</h2><button onClick={() => setUploads((old) => old.filter((entry) => entry.state === 'uploading' || entry.state === 'waiting'))}>Clear completed</button></div>{uploads.map((entry) => <div className="images-upload" key={entry.id}><span className="images-upload-name" title={entry.file.name}>{entry.file.name}</span><span>{entry.state === 'uploading' ? `${entry.progress}%` : entry.state === 'done' ? 'Uploaded' : entry.state === 'error' ? entry.error : 'Waiting'}</span>{entry.state === 'error' && <button onClick={() => void startUpload(entry)}>Retry</button>}{entry.state === 'uploading' && <progress max="100" value={entry.progress} aria-label={`${entry.file.name} upload progress`} />}</div>)}</section>}
      <section className="images-library"><div className="images-section-heading"><div><h2>Library</h2><p>{items.length} {items.length === 1 ? 'image' : 'images'} shown</p></div><div className="images-tools"><form onSubmit={(event) => { event.preventDefault(); setSearch(query.trim()); void load(query.trim()); }}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search names" aria-label="Search image names" /><button type="submit">Search</button></form><div className="images-view" aria-label="View mode"><button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-pressed={view === 'grid'}>Grid</button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-pressed={view === 'list'}>List</button></div></div></div>
        {error && <div className="images-error" role="alert">{error} <button onClick={() => void load(search)}>Retry</button></div>}
        {loading ? <p className="images-empty" role="status">Loading images…</p> : items.length === 0 ? <p className="images-empty">{search ? 'No images match your search.' : 'Your library is empty. Upload some images to get started.'}</p> : <div className={view === 'grid' ? 'images-grid' : 'images-list'}>{items.map((item) => <button className="images-card" key={item.id} onClick={() => open(item)}><span className="images-thumb"><img src={item.contentUrl} alt="" loading="lazy" /></span><span className="images-card-info"><strong title={item.fileName}>{item.fileName}</strong><small>{size(item.size)} · {date(item.createdAt)}</small></span></button>)}</div>}
        {cursor && <div className="images-more"><button className="images-secondary" disabled={moreLoading} onClick={() => void load(search, cursor)}>{moreLoading ? 'Loading…' : 'Load more'}</button></div>}
      </section>
    </div>
    {selected && <div className="images-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setSelected(null); }}><section className="images-modal" role="dialog" aria-modal="true" aria-label="Image details"><button ref={modalClose} className="images-modal-close" onClick={() => setSelected(null)} aria-label="Close image details">×</button><div className="images-preview"><img src={selected.contentUrl} alt={selected.fileName} /></div><div className="images-detail"><p className="images-kicker">IMAGE DETAILS</p>{editing ? <form onSubmit={save}><label>Name<input value={name} maxLength={180} required onChange={(event) => setName(event.target.value)} /></label><label>Description<textarea value={description} maxLength={2000} rows={4} onChange={(event) => setDescription(event.target.value)} /></label><div className="images-actions"><button className="images-primary" disabled={busy}>Save changes</button><button type="button" className="images-secondary" onClick={() => setEditing(false)}>Cancel</button></div></form> : <><h2>{selected.fileName}</h2>{selected.desc && <p>{selected.desc}</p>}<dl><div><dt>Original</dt><dd>{selected.originalName}</dd></div><div><dt>Format</dt><dd>{selected.contentType}</dd></div><div><dt>Size</dt><dd>{size(selected.size)}</dd></div><div><dt>Uploaded</dt><dd>{date(selected.createdAt)}</dd></div></dl><div className="images-actions"><button className="images-secondary" onClick={() => setEditing(true)}>Rename / edit</button><a className="images-secondary" href={selected.contentUrl} target="_blank" rel="noreferrer">View original</a><button className="images-danger" disabled={busy} onClick={() => void remove()}>Delete</button></div></>}{dialogError && <p className="images-dialog-error" role="alert">{dialogError}</p>}</div></section></div>}
  </main>;
}
