const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5001";

function tokenHeader() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function registerUser(username, password) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Register failed");
  return res.json();
}

export async function loginUser(username, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Login failed");

  const data = await res.json();
  localStorage.setItem("token", data.access_token);
  return data;
}

export function logoutUser() {
  localStorage.removeItem("token");
}

export async function getItems() {
  const res = await fetch(`${API_URL}/api/items`, {
    headers: { ...tokenHeader() },
  });
  if (!res.ok) throw new Error("Failed to fetch items");
  return res.json();
}

export async function createItem(title) {
  const res = await fetch(`${API_URL}/api/items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...tokenHeader(),
    },
    body: JSON.stringify({ title, is_done: false }),
  });
  if (!res.ok) throw new Error("Failed to create item");
  return res.json();
}

export async function toggleItem(id, is_done) {
  const res = await fetch(`${API_URL}/api/items/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...tokenHeader(),
    },
    body: JSON.stringify({ is_done }),
  });
  if (!res.ok) throw new Error("Failed to update item");
  return res.json();
}

export async function deleteItem(id) {
  const res = await fetch(`${API_URL}/api/items/${id}`, {
    method: "DELETE",
    headers: { ...tokenHeader() },
  });
  if (!res.ok) throw new Error("Failed to delete item");
}