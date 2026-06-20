// Thin API client for the Flask backend. All calls go through Vite's /api proxy
// in dev. Each function throws on network/HTTP error so callers can fall back.

const BASE = "/api";

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
  askDish: (dishId, question) => post(`/dish/${dishId}/ask`, { question }),
  refine: (payload) => post("/refine", payload),
};
