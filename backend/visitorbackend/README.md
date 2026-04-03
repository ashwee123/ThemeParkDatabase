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
- triggers to auto-flag expired tickets and auto-set review dates

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

