import { useEffect, useState, type FormEvent } from 'react';

type Todo = {
  id: number;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};

type Filter = 'all' | 'active' | 'completed';

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Something went wrong.');
  return result as T;
}

export default function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [error, setError] = useState('');

  async function loadTodos() {
    try {
      setError('');
      setTodos(await api<Todo[]>('/api/todos'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load tasks.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadTodos(); }, []);

  async function createTodo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    setError('');
    try {
      const todo = await api<Todo>('/api/todos', {
        method: 'POST',
        body: JSON.stringify({ title: trimmed }),
      });
      setTodos((current) => [todo, ...current]);
      setTitle('');
      setFilter('all');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add task.');
    } finally {
      setCreating(false);
    }
  }

  async function updateTodo(id: number, changes: Partial<Pick<Todo, 'title' | 'completed'>>) {
    setPendingId(id);
    setError('');
    try {
      const updated = await api<Todo>(`/api/todos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(changes),
      });
      setTodos((current) => current.map((todo) => todo.id === id ? updated : todo));
      setEditingId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update task.');
    } finally {
      setPendingId(null);
    }
  }

  async function deleteTodo(id: number) {
    setPendingId(id);
    setError('');
    try {
      await api<{ id: number }>(`/api/todos/${id}`, { method: 'DELETE' });
      setTodos((current) => current.filter((todo) => todo.id !== id));
      if (editingId === id) setEditingId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete task.');
    } finally {
      setPendingId(null);
    }
  }

  const activeCount = todos.filter((todo) => !todo.completed).length;
  const completedCount = todos.length - activeCount;
  const visibleTodos = todos.filter((todo) => filter === 'all' || todo.completed === (filter === 'completed'));

  return (
    <main className="todo-page">
      <div className="todo-wrap">
        <header className="todo-header">
          <div>
            <p className="todo-eyebrow">YOUR WORKSPACE / TASKS</p>
            <h1>Make room for what matters.</h1>
            <p className="todo-intro">A quiet place to capture the next thing and see it through.</p>
          </div>
          <div className="todo-tally" aria-label={`${activeCount} tasks left to do`}>
            <strong>{activeCount}</strong>
            <span>{activeCount === 1 ? 'task' : 'tasks'} left</span>
          </div>
        </header>

        <section className="todo-panel" aria-label="Your tasks">
          <form className="todo-create" onSubmit={createTodo}>
            <label className="sr-only" htmlFor="new-task">New task</label>
            <span className="todo-create-mark" aria-hidden="true">+</span>
            <input id="new-task" value={title} onChange={(event) => setTitle(event.target.value)}
              placeholder="What needs to get done?" maxLength={200} disabled={creating} />
            <button type="submit" disabled={!title.trim() || creating}>{creating ? 'Adding…' : 'Add task'}</button>
          </form>

          <div className="todo-controls">
            <div className="todo-filters" role="group" aria-label="Filter tasks">
              {(['all', 'active', 'completed'] as const).map((option) => (
                <button key={option} type="button" className={filter === option ? 'selected' : ''}
                  aria-pressed={filter === option} onClick={() => setFilter(option)}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </button>
              ))}
            </div>
            <span className="todo-count">{completedCount} completed</span>
          </div>

          {error && <div className="todo-error" role="alert">{error} <button type="button" onClick={() => void loadTodos()}>Retry</button></div>}

          {loading ? (
            <p className="todo-empty" role="status">Loading your tasks…</p>
          ) : visibleTodos.length === 0 ? (
            <div className="todo-empty">
              <span aria-hidden="true">✳</span>
              <h2>{todos.length === 0 ? 'Start with one small thing.' : 'Nothing here right now.'}</h2>
              <p>{todos.length === 0 ? 'Add a task above and it will appear here.' : 'Try another filter to see your tasks.'}</p>
            </div>
          ) : (
            <ul className="todo-list">
              {visibleTodos.map((todo) => (
                <li key={todo.id} className={todo.completed ? 'todo-item completed' : 'todo-item'}>
                  <button className="todo-check" type="button" disabled={pendingId === todo.id}
                    aria-label={todo.completed ? `Mark ${todo.title} active` : `Complete ${todo.title}`}
                    aria-pressed={todo.completed}
                    onClick={() => void updateTodo(todo.id, { completed: !todo.completed })}>
                    {todo.completed && <span aria-hidden="true">✓</span>}
                  </button>
                  {editingId === todo.id ? (
                    <form className="todo-edit" onSubmit={(event) => {
                      event.preventDefault();
                      if (editTitle.trim()) void updateTodo(todo.id, { title: editTitle.trim() });
                    }}>
                      <label className="sr-only" htmlFor={`edit-${todo.id}`}>Edit task</label>
                      <input id={`edit-${todo.id}`} autoFocus value={editTitle} maxLength={200}
                        onChange={(event) => setEditTitle(event.target.value)}
                        onKeyDown={(event) => { if (event.key === 'Escape') setEditingId(null); }} />
                      <button type="submit" disabled={!editTitle.trim() || pendingId === todo.id}>Save</button>
                      <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                    </form>
                  ) : (
                    <>
                      <span className="todo-title">{todo.title}</span>
                      <div className="todo-actions">
                        <button type="button" disabled={pendingId === todo.id} onClick={() => { setEditingId(todo.id); setEditTitle(todo.title); }}>Edit</button>
                        <button type="button" disabled={pendingId === todo.id} onClick={() => void deleteTodo(todo.id)}>Delete</button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
        <p className="todo-footnote">A little progress adds up.</p>
      </div>
    </main>
  );
}
