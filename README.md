# MenuCurator

An AI menu concierge for restaurants with large menus. A diner scans a QR code at
their table and, instead of scrolling through hundreds of dishes or repeatedly
flagging down a waiter, gets help in three ways — powered by the Gemini API.

It is a **decision helper, not an ordering system**: no cart, no table numbers,
no payment. It helps diners decide what to order; the final call stays with them.

---

## Features

- **Find dishes for us** — Tap a few preferences (party size, budget,
  veg/non-veg/Jain, course, cuisine, spice, drinks, plus a free-text note) and
  the AI returns tailored picks: **3 curated combos** (complete sets grouped by
  course) and **individual dishes**, each with a one-line "why". Recommendations
  scale to the party size and respect the budget as a total ceiling.
- **Ask about a dish** — Open any dish and ask anything ("how many pieces?",
  "enough for four?", "how spicy?"). The AI answers from that dish's own details
  and defers out-of-scope questions to the staff. Conversations keep context
  within a session.
- **Refine my picks** — Select dishes yourself across categories, then ask the
  AI to balance the order, flag what's missing, and suggest what pairs well.

---

## Tech stack

- **Frontend:** React + Vite (single-page, fully responsive)
- **Backend:** Flask (Python)
- **LLM:** Google Gemini (`gemini-3.1-flash-lite-preview` by default)

No database — the menu is static JSON in the backend. The only secret is the
Gemini API key. Without a key the backend runs in **MOCK_MODE** (deterministic
canned responses) so the app is fully usable offline for UI work.

---

## Project structure

```
.
├── frontend/        React + Vite diner app
└── backend/         Flask API + menu data + Gemini client
    ├── app/         routes, service logic, menu access, Gemini client
    ├── tests/       end-to-end API tests
    └── logs/        per-session prompt/response traces (auto-created)
```

---

## Prerequisites

- **Python 3.10+**
- **Node.js 18+** and **npm**
- A **Google Gemini API key** (optional — omit to run in MOCK_MODE)

---

## Setup & running

The backend runs on **http://127.0.0.1:5000** and the frontend on
**http://localhost:5173** (Vite proxies `/api` to the backend).

### 1. Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env        # Windows: copy .env.example .env
# Open .env and set your key:  GEMINI_API_KEY=your_key_here
# (Leave it blank to run in MOCK_MODE without a key.)

# Run the server
python server.py            # http://127.0.0.1:5000
```

### 2. Frontend

In a separate terminal:

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

Open **http://localhost:5173** in your browser.

> After editing `menu.json` or backend config, restart the Flask server — menu
> data is loaded once at startup.

---

## Configuration

All backend settings are read from `backend/.env` (see `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | _(empty)_ | Gemini API key. Empty → MOCK_MODE. |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite-preview` | Model used for all calls. |
| `MOCK_MODE` | auto | Force canned responses. Auto-on when no key is set. |
| `HOST` / `PORT` | `127.0.0.1` / `5000` | Backend bind address. |
| `CORS_ORIGINS` | `localhost:5173`, `127.0.0.1:5173` | Allowed frontend origins. |

---

## API endpoints

| Method & path | Purpose |
|---|---|
| `GET /api/health` | Liveness, current mode and model. |
| `GET /api/menu` | Restaurant info + available dishes. |
| `POST /api/recommend` | "Find dishes for us" — individual picks + 3 combos. |
| `POST /api/dish/<id>/ask` | "Ask about a dish" — Q&A about one dish. |
| `POST /api/refine` | "Refine my picks" — balance/pairing advice. |

---

## Testing

End-to-end API tests hit every endpoint with realistic payloads (recommend
scenarios, dish Q&A, refine flows, conversation history, tracing) and validate
response shape, party-size scaling, and that no invalid dishes are returned.

```bash
cd backend
.venv/Scripts/python -m tests.test_api     # macOS/Linux: .venv/bin/python
```

With a Gemini key set, the suite makes real API calls; otherwise it validates
the MOCK_MODE responses.
