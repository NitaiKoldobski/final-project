import { useEffect, useMemo, useState } from "react";
import "./App.css";
import {
  createItem,
  deleteItem,
  getItems,
  loginUser,
  logoutUser,
  registerUser,
  toggleItem,
} from "./services/api";

export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem("token"));

  const [items, setItems] = useState([]);
  const [title, setTitle] = useState("");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const stats = useMemo(() => {
    const done = items.filter((i) => i.is_done).length;
    return { done, open: items.length - done, total: items.length };
  }, [items]);

  async function refresh() {
    try {
      setError("");
      setLoading(true);
      const data = await getItems();
      setItems(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authed) refresh();
  }, [authed]);

  async function onLogin() {
    try {
      setError("");
      setLoading(true);
      await loginUser(username.trim(), password);
      setAuthed(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function onRegister() {
    try {
      setError("");
      setLoading(true);
      await registerUser(username.trim(), password);
      await loginUser(username.trim(), password);
      setAuthed(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function onLogout() {
    logoutUser();
    setAuthed(false);
    setItems([]);
    setTitle("");
    setUsername("");
    setPassword("");
    setError("");
  }

  async function onAdd(e) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;

    try {
      setError("");
      setLoading(true);
      await createItem(t);
      setTitle("");
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function onToggle(item) {
    try {
      setError("");
      setLoading(true);
      await toggleItem(item.id, !item.is_done);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(id) {
    try {
      setError("");
      setLoading(true);
      await deleteItem(id);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!authed) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Welcome 👋</h1>
          <p>Login or register to continue</p>

          <input
            className="input"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          <div className="row">
            <button
              className="btn btnPrimary"
              onClick={onLogin}
              disabled={loading || !username.trim() || !password}
            >
              Login
            </button>
            <button
              className="btn"
              onClick={onRegister}
              disabled={loading || !username.trim() || !password}
            >
              Register
            </button>
          </div>

          {error && <div className="error">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="app-page">
      <div className="app-shell">
        <div className="topbar">
          <div>
            <h1 className="title">To-Do</h1>
            <p className="subtitle">Private tasks • JWT auth • Flask + Postgres</p>
          </div>

          <div className="row">
            <span className="badge">
              {loading ? "Syncing…" : `${stats.open} open • ${stats.done} done`}
            </span>
            <button className="btn" onClick={onLogout} disabled={loading}>
              Logout
            </button>
          </div>
        </div>

        <div className="grid2">
          <div className="card">
            <h2 className="cardTitle">Add a task</h2>
            <form onSubmit={onAdd} className="row">
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
                disabled={loading}
              />
              <button
                className="btn btnPrimary"
                type="submit"
                disabled={loading || !title.trim()}
              >
                Add
              </button>
            </form>

            {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
          </div>

          <div className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2 className="cardTitle">Your tasks</h2>
              <span className="small">{stats.total} total</span>
            </div>

            {items.length === 0 ? (
              <div className="empty">
                <div className="emptyTitle">No tasks yet</div>
                <div className="small">Add your first task on the left 👈</div>
              </div>
            ) : (
              <ul className="list">
                {items.map((item) => (
                  <li key={item.id} className="item">
                    <label className="checkRow">
                      <input
                        type="checkbox"
                        checked={item.is_done}
                        onChange={() => onToggle(item)}
                        disabled={loading}
                      />
                      <span className={item.is_done ? "done" : ""}>{item.title}</span>
                    </label>

                    <button
                      className="btn btnGhost"
                      onClick={() => onDelete(item.id)}
                      disabled={loading}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}