// Thin API client for the Flask backend. All calls go through Vite's /api proxy
// in dev. Each function throws on network/HTTP error so callers can fall back.

const BASE = "/api";

// One stable id per page load (one diner session). Every POST carries it so the
// backend can group an entire session's prompts/responses into one trace log.
const SESSION_ID =
  (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
  "s" + Date.now() + Math.random().toString(36).slice(2, 8);

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, session_id: SESSION_ID }),
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

async function get(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

export const api = {
  getMenu: () => get("/menu"),
  recommend: (payload) => post("/recommend", payload),
  askDish: (dishId, question, history) => post(`/dish/${dishId}/ask`, { question, history }),
  refine: (payload) => post("/refine", payload),
};
