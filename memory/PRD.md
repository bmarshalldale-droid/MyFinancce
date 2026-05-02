# MyFinance — Product Requirements Document

## Original Problem Statement
User shared a complete single-file HTML preview of "MyFinance" (a personal finance tracker with Home, Budget, Expenses, Debts, Paid tabs, bucket allocation, debt-payoff confetti). Asked to convert it to a proper React + FastAPI + MongoDB full-stack app with cloud sync, JWT email/password auth, port functionality as-is, and **refresh the design**.

## Architecture
- **Frontend**: React 19 + React Router 7 + Tailwind CSS + @phosphor-icons/react + framer-motion + canvas-confetti.
- **Backend**: FastAPI + Motor (async MongoDB) + bcrypt + PyJWT.
- **Auth**: JWT email/password, Bearer token in localStorage (key `mf_token`), 30-day expiry, axios interceptor attaches header automatically.
- **Data scoping**: every resource (expenses, debts, buckets, budget) keyed by `user_id` (UUID string from JWT `sub`).

## User Personas
- **Solo user** managing personal finances across devices — single account = single financial picture.

## Core Requirements (Static)
- Cloud-synced data across devices
- Auth wall — only logged-in users see data
- Multi-user isolation (one user's data invisible to others)
- Mobile-first UI, but works on desktop too
- Original feature parity (no functionality removed)

## What's Been Implemented (2026-01-XX)
### Backend (`/app/backend/server.py`)
- `POST /api/auth/register` — creates user, hashes password (bcrypt), seeds 4 default buckets + empty budget, returns JWT
- `POST /api/auth/login` — verifies credentials, returns JWT
- `GET /api/auth/me` — returns current user
- `GET/POST/PUT/DELETE /api/expenses` — full CRUD scoped to user
- `GET/POST/DELETE /api/debts`, `GET /api/debts/paid`, `POST /api/debts/{id}/payments` — debt + payment lifecycle, auto-archives debt when remaining hits 0 (sets `paid:true`, `paidDate`)
- `GET/PUT /api/budget` — single-doc upsert per user (salary, freq, payDate)
- `GET/POST/PUT/DELETE /api/buckets` — bucket CRUD (name, pct, colour)
- MongoDB indexes: users.email unique; user_id on expenses/debts/buckets

### Frontend (`/app/frontend/src/`)
- **Auth pages** (`pages/Login.jsx`, `pages/Register.jsx`) — split-screen earthy aesthetic, paper-texture image
- **Protected dashboard** (`pages/MyFinance.jsx`) — five tabs:
  - **Home**: greeting, dark surplus card with terracotta glow, next-pay countdown, due-this-period count, pay-period bucket allocation visual, upcoming payments, debt progress preview
  - **Budget**: salary + freq + pay-date setup, days-until-pay, monthly income/expenses summary, remaining-after-expenses progress bar, expense breakdown sorted, bucket CRUD with 12-colour earthy picker, split-overview bar
  - **Expenses**: monthly/annual summary cards, horizontal category filter chips, expense list with edit/delete and due-date urgency colours, upcoming-this-period summary
  - **Debts**: total + monthly-out summary, debt cards with progress bars, payment logging with confetti on full payoff
  - **Paid**: total cleared, debts paid off count, cleared-debt list with paid badges
- **Modals**: Add/edit expense, add debt, log payment, add/edit bucket — all bottom-sheet animated
- **Confetti**: canvas-confetti burst when a debt is fully paid off, then auto-switches to Paid tab

### Design Refresh
- **Palette**: Bone (#F5F4F0), Terracotta (#D1603D), Moss (#4A6B5D), Ochre (#E8A365), Clay (#C44D42), Espresso ink (#1C1B1A) — replaces old dark-with-lime-green
- **Typography**: Cabinet Grotesk (display) + Manrope (body) + JetBrains Mono (numbers) — replaces DM Sans/Mono
- **Light theme** with subtle paper-texture radial gradients
- **Bottom tab nav** with active terracotta accent + Phosphor icons
- **Cards**: flat white with 1px line-color borders and 12px radius

## Prioritized Backlog
- **P1**: Add charts (recharts) — monthly cash-flow and debt-payoff projections
- **P1**: Recurring auto-deduction — automatically advance dueDate when expenses are paid
- **P2**: CSV export of transactions and debts
- **P2**: Dark mode toggle
- **P2**: AI insights — "where can I cut?" with Emergent LLM key
- **P3**: Email reminders for upcoming payments (SendGrid)
- **P3**: Multi-currency support

## Test Coverage
- 18/18 backend pytest tests passing — auth, CRUD, payment lifecycle, multi-tenancy isolation, 401s
- Frontend smoke-tested via Playwright (register → home flow verified)

## Next Tasks
- (Optional) Return 404 from DELETE endpoints when nothing matches
- (Optional) Validate `PaymentIn.amount > 0` and reject payments on already-paid debts
- (Optional) Migrate `@app.on_event` → FastAPI lifespan context
