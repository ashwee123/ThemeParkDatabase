# Visitor Portal Backend (No Express)

This backend exposes a JSON API for:

- Visitor auth (`/api/visitor/login`, `/api/visitor/register`, `/api/visitor/me`)
- Tickets CRUD
- Reviews CRUD
- Children CRUD
- Queries + Reports

It uses Node.js `http` + `mysql2` (no Express).

## 1) Database setup (MySQL Workbench)

Run:
- `sql files/visitor_views_and_triggers.sql`

It creates:
- `v_visitor_expired_tickets`
- `v_area_avg_ratings`

Note: this portal does **not** use MySQL triggers. Expired-ticket “auto-flagging” is handled in the Node backend based on `ExpiryDate`.

## 2) Install dependencies

In `backend/visitorbackend/` run:

```bash
npm install
```

## 3) Configure environment

Copy `.env.example` to `.env` and update:

- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET`

## 4) Start the server

```bash
npm start
```

Server listens on `VISITOR_PORT` (default `3002`).

## 5) API base

All endpoints are under:

- `http://localhost:3002/api/...`

## 6) Demo / presentation data (optional)

To load a **moderate** amount of realistic data (visitors, tickets, reviews, children) for demos and reports:

1. Ensure migrations/views are applied (`visitor_ticket_type_migration.sql`, `visitor_views_and_triggers.sql`).
2. Choose one:

**A — Pure MySQL (Workbench / `mysql` CLI):** run `sql files/visitor_presentation_seed_mysql.sql` against your database (edit `USE newthemepark;` if your DB name differs).

**B — Node script:** from `backend/visitorbackend` run:

```bash
npm run seed:presentation
```

Both approaches create the same demo accounts: emails ending in `@presentation-demo.local`, password `Demo1234!`. They delete any previous rows for those emails first, then re-seed.

