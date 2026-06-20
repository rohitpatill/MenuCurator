# MenuCurator — Project Blueprint & Context

> **LOCAL-ONLY FILE** (gitignored). The single source of truth for *what this
> project is, how it's structured, and how data flows.* Read this first before
> touching the code.

---

## 1. What this is

**MenuCurator** is an AI menu concierge for restaurants with large menus. A diner
scans a QR at their table and, instead of scrolling 500+ dishes or interrogating
a waiter, gets help in three ways:

1. **Find dishes for us** (the USP) — tap a few preference chips → AI returns
   tailored picks, shown two ways: **3 curated Combos** (complete sets grouped
   by course) and **Individual** dishes, each with a one-line "why".
2. **Ask about a dish** — browse the menu by category, tap any dish, ask
   anything ("how many pieces?", "enough for 4?", "how spicy?") → AI answers
   from that dish's metadata.
3. **Refine my picks** — pick dishes yourself across categories, then ask the AI
   to balance the order / suggest what's missing / what pairs well.

It is a **decision helper, not an ordering/POS system** — no table numbers, no
cart, no payment. The product is "MenuCurator"; the demo restaurant is "Marigold".

LLM provider: **Gemini only** (`gemini-2.5-flash-lite` default). Falls back to a
deterministic **MOCK_MODE** when no API key is set, so the whole app is usable
offline for UI work.

---

## 2. Top-level structure

```
HMC/
├── frontend/        React + Vite single-page diner app (fully responsive)
├── backend/         Flask API: Gemini + the menu data
│   ├── tests/       end-to-end API tests (test_api.py) — hits every endpoint
│   └── logs/        per-session prompt/response traces (gitignored, auto-created)
├── docs/            LOCAL-ONLY git guide (gitignored, holds the push token)
├── CONTEXT.md       this file (gitignored)
├── usecase.md       product use-case write-up (gitignored)
└── .gitignore
```

No database. The menu lives as a static JSON in the backend. The only secret is
the Gemini API key, read from `backend/.env`.

---

## 3. Backend (`backend/`) — Flask, Gemini-only

### Data flow (request lifecycle)
```
React fetch  →  /api/* route (routes.py)
             →  service.py  (pre-filter menu deterministically, build prompt)
             →  menu.py     (load/filter/slim the dish data)
             →  gemini.py   (call Gemini)   ── or ──  mock fallback in service.py
             →  JSON response back to React
```
Key principle: **deterministic narrowing happens in Python first** (diet, course,
budget, availability), then Gemini only does *judgement* (which to pick, how to
phrase). Sold-out dishes are filtered out before the model ever sees them.

### Files

| File | Lines | Purpose |
|------|------:|---------|
| `server.py` | 34 | Flask entry point. `create_app()` builds the app, enables CORS for the dev frontend, registers the API blueprint under `/api`, and adds a root `/` info route. Run with `python server.py`. **Named `server.py` (not `app.py`) to avoid clashing with the `app/` package.** |
| `config.py` | 41 | All configuration, read from env / `.env`. Holds `GEMINI_API_KEY`, `GEMINI_MODEL`, `MOCK_MODE` (auto-on if no key), host/port/debug, CORS origins, restaurant name/tagline. The one place settings live. |
| `requirements.txt` | — | `Flask`, `flask-cors`, `httpx`, `python-dotenv`. |
| `.env` / `.env.example` | — | `.env` holds the real Gemini key (gitignored). `.env.example` is the committed template. |
| `app/__init__.py` | 0 | Marks `app/` as a package. |
| `app/routes.py` | 69 | The HTTP layer — a Flask Blueprint defining every endpoint (see §3.1). Thin: parses the request body, calls `service.py`, returns JSON. No business logic here. |
| `app/service.py` | 308 | **The brain.** Owns the three features' logic: holds the **detailed system prompts** (`RECOMMEND_SYSTEM`, `DISH_SYSTEM`, `REFINE_SYSTEM` — strict JSON-only contract for recommend; "I only have this dish's details, ask the manager" deferral for out-of-scope dish questions, but conversation-recall questions are answered from history). `ask_dish`/`refine` lead the conversation with a facts/context block, then replay `_clean_history()` of the session thread (drops the client greeting, caps to last 20 turns), then the live question — so chats stay contextual. Builds the user prompts, calls Gemini, hydrates/validates output back into full dish cards (empty/invalid → mock fallback), and provides the deterministic **mock fallbacks** used in MOCK_MODE or on any Gemini error. |
| `app/menu.py` | 150 | **Menu data access.** Loads `menu.json` once at import, exposes `get_dish`, `available_dishes`, `apply_filters` (the deterministic chip-filter logic — **food-type dishes only, breads excluded**; supports the `nobutter` extra via `_has_butter` derived from ingredients), `drink_candidates` (mocktail/cocktail/both per the Drinks chip), and `compact` (slim dish shape for prompts to save tokens). |
| `app/menu.json` | — | **The entire menu** (~138 dishes; richer 2-3 sentence descriptions for better dish Q&A). Static data, no DB. Each dish carries all filterable metadata. A couple are marked `available:false` (sold-out handling); accompaniment breads carry `"bread": true` so they're excluded from recommendations. Edit via `tests/build_menu.py`, not by hand. |
| `app/trace.py` | 110 | **Per-session request/prompt tracing.** Every diner session (one frontend page load → one `session_id`) gets ONE JSONL file at `backend/logs/session-<id>.jsonl`. Each transaction (recommend / ask / refine) is one JSON line capturing: timestamp, endpoint, raw request, the **exact dynamic system+user prompt**, `mode` (`gemini` \| `mock`), `fallback_reason` (e.g. the Gemini error that caused a mock fallback), raw model output, final result, and `ms`. Never raises — a logging failure can't break a request. The single best tool for verifying whether a call really hit Gemini. |
| `tests/build_menu.py` | 130 | **Menu data builder (maintenance script, not app code).** Idempotently applies bulk edits to `menu.json`: flags accompaniment breads, enriches short descriptions, and appends new dishes (skipping any name that already exists). Run `.venv/Scripts/python -m tests.build_menu`, then **restart Flask**. Use this for menu data changes rather than hand-editing the JSON. |
| `tests/test_api.py` | 480 | **End-to-end API test suite.** Uses Flask's test client to hit every endpoint with payloads shaped exactly as the frontend sends them, across ~12 recommend scenarios + edge cases, all dish-Q&A intents (incl. out-of-scope deferral), refine flows, a **conversation-history test** (sends a prior thread, asks a history-only question, asserts the answer reflects it), and a **tracing test** that asserts one log line per transaction and (with a key) that real Gemini was used — not a silent mock fallback. Validates response *shape* + **no hallucinated ids** + **no drinks leak when Drinks=None**. Run: `.venv/Scripts/python -m tests.test_api` (exit code non-zero on any failure). |
| `app/gemini.py` | 135 | **Single-provider Gemini client.** `generate_json()` (structured, JSON mode) and `generate_text()` (plain text), both blocking via `httpx.Client`. `extract_json()` is a **robust JSON-recovery parser** — peels ```json fences, prose preambles, and trailing commas so a stray backtick never breaks a feature. `thinkingBudget` set to **512** (the model's minimum — values below 512 are rejected with a 400) so tokens go to the visible answer. `generate_text` accepts an optional `history` (prior `{role,text}` turns) and `_build_contents` maps it into Gemini's multi-turn `contents` (our `ai`→Gemini `model`), so chats keep context. Raises `GeminiError` on failure (caught by service.py → mock fallback, with the reason recorded in the session trace). |

### 3.1 API endpoints (`routes.py`)

| Method & path | Feature | Request body | Response |
|---|---|---|---|
| `GET /api/health` | — | — | `{status, mock_mode, model}` |
| `GET /api/menu` | menu browse | — | `{restaurant, tagline, currency, dishes[]}` — **available dishes only** |
| `POST /api/recommend` | Feature 2 | `{filters, extras, note, party_size, session_id}` | `{individual[], combos[], candidates[]}` |
| `POST /api/dish/<id>/ask` | Feature 1 | `{question, session_id, history[]}` | `{answer}` |
| `POST /api/refine` | Feature 3 | `{picked_ids[], question, party_size, session_id, history[]}` | `{answer}` |

> `session_id` (optional) is the frontend's per-page-load id; the backend uses it
> only to name the per-session trace log (`backend/logs/session-<id>.jsonl`).
> `history` (optional) is the running chat thread for that conversation —
> `[{role:"user"|"ai", text}]` in order. The backend replays it to Gemini as
> real multi-turn context so dish Q&A and refine stay contextual within a
> session ("what did I ask before?", "list my picks"). History is **never
> persisted** — it lives only in frontend state and is re-sent each turn.

### 3.2 Dish schema (one entry in `menu.json`)
```jsonc
{
  "id": "d001",
  "name": "Tandoori Malai Broccoli",
  "cuisine": "Indian",          // Indian | Chinese | Continental | Italian | Bar | Mocktail | Cocktail | Beverage
  "course": "Starter",          // Starter | Main | Dessert | Drink
  "diet": "veg",                // veg | nonveg
  "jain": false,                // can be served Jain
  "spice": "Mild",              // Mild | Medium | Spicy | null (no chilli / drinks)
  "price": 420,
  "serves": 2,
  "pieces": 8,                  // or null when served as a shared portion
  "tag": "chefspecial",         // bestseller | chefspecial | null
  "nog": false,                 // no onion-garlic
  "allergens": ["dairy"],       // nut | dairy | gluten | egg | fish | shellfish | soy
  "type": "food",               // food | mocktail | cocktail | spirit | beverage
  "bread": false,               // true = accompaniment bread, excluded from recommends (optional)
  "available": true,            // false = sold out, hidden everywhere
  "ingredients": ["broccoli", "cream cheese", ...],
  "desc": "Florets in a smoky cream-cheese marinade…"
}
```
`type` drives the beverage sub-tabs: `mocktail`, `cocktail`, `spirit`
(neat alcohol + beer + wine), `beverage` (tea/coffee/soft).

---

## 4. Frontend (`frontend/`) — React + Vite

Fully responsive **single app that fills the whole screen** at every size
(phone = full-screen mobile; laptop/tablet = full-screen with content in a
centered readable column). No phone-mockup framing. Plain inline-styles +
one CSS file with breakpoints. Strictly modular — every file is small
(largest ~156 lines).

### Data flow (frontend)
```
useMenuApp()  ── holds ALL state + actions, calls api.js
     │
     ├─ App.jsx        reads the hook, renders shell + routes the current screen
     │
     ├─ screens/*      dumb-ish screen views, fed props from the hook
     ├─ components/*    shared building blocks (header, cards, chat bar, etc.)
     ├─ ui.jsx          style tokens + tiny atoms (DietMark, Spark, Bubble…)
     ├─ constants.js    filter definitions, defaults, suggested questions
     └─ api.js          fetch wrapper → backend (/api proxied by Vite)
```
**Single source of truth:** `useMenuApp` owns every piece of state, including
`picks` (a `{dishId: true}` map) and the chat threads (`chat` for dish Q&A,
`refineChat` for refine). Screens never hold cross-screen state — so selecting
dishes across categories/diet tabs never loses the selection. Each chat turn
re-sends the thread-so-far as `history` to the backend for multi-turn context;
threads are in-memory only (cleared when the conversation is left).

### Routing
There is no router library. `screen` state (`home | filter | results | menu |
refine | dish`) decides which screen renders. `App.jsx` is a switchboard.

### Files

| File | Lines | Purpose |
|------|------:|---------|
| `index.html` | — | Vite HTML shell; loads Google Fonts (Plus Jakarta Sans + Cormorant Garamond) and `main.jsx`. |
| `vite.config.js` | — | Vite + React plugin; dev server on **5173**, proxies `/api` → Flask on **5000**. |
| `src/main.jsx` | 10 | React root; mounts `<App/>`, imports `styles.css`. |
| `src/styles.css` | 156 | The **responsive shell** + theme variables + keyframe animations. `.app` is always full viewport; `.pad` centers content in a readable column on wide screens; `.grid-2` collapses on phones. The core of the "fills the whole screen" behaviour. |
| `src/api.js` | 33 | Thin fetch client: `getMenu`, `recommend`, `askDish(id, question, history)`, `refine`. Generates one `SESSION_ID` per page load and attaches it to every POST body so the backend groups the whole session's prompts into one trace log. Dish/refine calls also pass the running chat `history`. Throws on HTTP error so callers can fall back to a friendly message. |
| `src/constants.js` | 54 | `FILTER_GROUPS` (the 7 chip filters), `EXTRA_CHIPS` (Show-more filters incl. **No butter**), `DEFAULT_FILTERS`, `partySize(party, custom)` (maps the party chip to a head-count; returns the custom value when "Custom" is selected), and the suggested-question lists for dish Q&A and refine. |
| `src/ui.jsx` | 143 | Shared **style tokens** (fonts, gradient, diet colours) + reusable style objects (`chipStyle`, `cardBox`, `reasonBox`, `bubble`) + tiny atoms: `DietMark`, `Spark`, `Arrow`, `Bubble`, `Typing`. |
| `src/useMenuApp.js` | 148 | **The state hook.** All screen state, the `picks` map, `partyCustom` (exact head-count when the party chip is "Custom"), the chat threads, and every action (`runFilter`, `openMenu`, `runRefine`, `askRefine`, `openDish`, `ask`, `back`, …). `ask`/`askRefine` pass the thread-so-far as `history` for multi-turn context. Calls `api.js`; handles loading (`busy`) and network-error fallbacks. Keeps `App.jsx` a thin router. |
| `src/App.jsx` | 85 | App shell (Header + scrolling body + contextual Footer/ChatBar) and the screen switch. Wires hook state/actions into each screen. No business logic. |

#### `src/screens/`

| File | Lines | Purpose |
|------|------:|---------|
| `Home.jsx` | 86 | Landing screen: the 3 entry points (hero "Find dishes for us" + two cards "Ask about a dish" / "Refine my picks"). |
| `Filter.jsx` | 96 | Feature 2 input: renders the 7 chip filter groups from `constants.js`, the optional free-text note, and the "Show more options" extra chips. When the Party-size "Custom" chip is selected, reveals a **−/+ stepper** (1–50 guests) bound to `partyCustom`. |
| `Results.jsx` | 59 | Feature 2 output: the **Combos / Individual** toggle. Combos → `ComboCard`, Individual → `DishCard`. Shows the filter summary line and an empty state. |
| `Menu.jsx` | 143 | Feature 1 & 3 browse screen (one component, `mode = ask | pick`). **Category navigation:** sticky tabs (Starters/Mains/Desserts/Beverages); a Veg/Non-veg filter on Starters & Mains only; beverage sub-tabs (Mocktails/Cocktails/Spirits&Beer/Tea,Coffee&Soft). Ask mode → tap opens dish Q&A; Pick mode → tap toggles selection (persists across tabs). |
| `Refine.jsx` | 37 | Feature 3 conversation: shows the picked-dish chips + the chat thread with MenuCurator. |
| `Dish.jsx` | 31 | Feature 1 conversation: dish header (price/serves/spice) + the Q&A chat thread. |

#### `src/components/`

| File | Lines | Purpose |
|------|------:|---------|
| `Header.jsx` | 39 | Top bar: restaurant name + tagline, optional back button. |
| `Footer.jsx` | 27 | Sticky bottom CTA container + the shared `ctaBase` button style. |
| `ChatBar.jsx` | 63 | Reusable chat input: suggested-question chips + text input + send button. Used by both Dish Q&A and Refine. |
| `Busy.jsx` | 30 | Full-screen "thinking" overlay (spinner + message) shown during AI calls. |
| `MenuRow.jsx` | 63 | One menu line. Ask mode → chevron; Pick mode → checkbox. Shows diet mark, name, tag, description, price. |
| `DishCard.jsx` | 51 | One recommended dish in the Individual results view (with "why" + Ask button). |
| `ComboCard.jsx` | 47 | One curated set in the Combos results view: grouped by course, with a "why" and a set total. |

---

## 5. The three features end-to-end

### Feature 2 — Find dishes for us (recommend)
1. `Filter.jsx` collects chips → `useMenuApp.runFilter()` → `POST /api/recommend`.
2. `service.recommend()` calls `menu.apply_filters()` (diet/course/cuisine/spice/
   budget/extras, available only) + `drink_candidates()`.
3. Compact candidate list → Gemini (JSON mode) → returns `individual` + 3 `combos`.
4. `service._hydrate()` maps returned ids back to full dish cards, groups combos
   by course, computes set totals.
5. `Results.jsx` shows the **Combos / Individual** toggle.

### Feature 1 — Ask about a dish
1. `Menu.jsx` (ask mode) → tap dish → `openDish()` → `Dish.jsx` + `ChatBar`.
2. Question → `POST /api/dish/<id>/ask` → `service.ask_dish()` sends only that
   dish's facts to Gemini (text mode) → short answer.

### Feature 3 — Refine my picks
1. `Menu.jsx` (pick mode) → select dishes across categories (`picks` map) →
   `runRefine()` → `POST /api/refine`.
2. `service.refine()` sends picked dishes + the available menu + party size to
   Gemini → balance/pairing/portion advice. Follow-ups via `ChatBar`.

---

## 6. Running locally

```bash
# Backend
cd backend
cp .env.example .env          # add GEMINI_API_KEY, or leave blank for MOCK_MODE
.venv/Scripts/python server.py   # http://127.0.0.1:5000

# Frontend
cd frontend
npm install
npm run dev                   # http://localhost:5173  (proxies /api → :5000)
```
After editing `menu.json` or backend config, **restart Flask** (no hot reload for data).

---

## 7. Conventions & decisions worth remembering

- **Gemini-only.** The earlier multi-provider abstraction was dropped.
- **Deterministic-first, AI-for-judgement.** Filtering is Python; taste/phrasing
  is Gemini. Keeps results correct, cheap, and never shows sold-out items.
- **Recommend like a real diner, with explicit per-course minimums.** Soft
  "scale with the group" hints weren't enough — the model kept under-serving
  drinks. So `service._combo_targets(party_size, has_drinks)` computes a MINIMUM
  number of distinct dishes per course (derived from party_size, not hardcoded
  per size: ~1 per 2-3 people → a table of 8 ≈ 3 starters, 4 mains, 3 desserts,
  3 drinks; a solo diner = 1 of each). These are passed in the prompt as
  `min_per_combo` and the prompt makes meeting them MANDATORY (with a worked
  example), budget permitting. A worded "order a couple of portions" hint covers
  quantity — no quantity fields. Recommend uses `max_tokens=4096` (bigger combos
  = more JSON).
- **Budget is a TOTAL ceiling for the whole table, not per-dish.** The numeric
  cap is passed as `budget_total_cap`; each combo's SET TOTAL must stay at/under
  it. When the budget is tight for a big party, the AI fits the cap FIRST and
  trades down variety (correct trade-off — variety grows when budget allows).
  The mock fallback enforces the same via `fit_budget()` (drops the priciest
  item until the total fits). **Breads are never recommended** (default
  accompaniment); the AI helps decide curries/starters/mains/desserts/drinks
  only. No cart/quantity — we suggest, we don't fix a menu.
- **MOCK_MODE** keeps the app fully working with no API key.
- **One state hook** (`useMenuApp`) — screens are presentational; `picks` persist
  across all navigation.
- **Modular & small** — every file kept well under ~300 lines.
- **Not an ordering system** — decision help only (no cart/table/payment).
- **Git:** commit in small logical units, conventional messages, never commit
  secrets/`docs/`/`node_modules`/`.venv`. Push flow + token live in `docs/`.


Most important instruction for you is Whenever you will do any change in this code Whatever that change will be Make sure you will perfectly update this file if required if you add any new file do any meaningful changes in existing files or whatever architectural changes This file should be always updated as perfectly as possible 