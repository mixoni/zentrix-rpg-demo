# Zentrix Lab – RPG Backend (3 Services, TypeScript/Node, Postgres, Redis, Docker Compose)

This repo contains **three independently runnable services** (separate processes, DBs, migrations) organized in a single folder for easy review.

- **account-service**: registration + login, issues JWT (`role`: `User` or `GameMaster`)
- **character-service**: characters, classes, items, inventory, Redis caching for `GET /api/character/:id`
- **combat-service**: duels + turn actions, pulls character snapshots from Character Service and notifies Character Service to resolve loot

## Quick start (Docker)

```bash
docker compose up --build
```

Services:
- Account:   http://localhost:3001
- Character: http://localhost:3002
- Combat:    http://localhost:3003

Databases:
- Postgres (account):   localhost:5433
- Postgres (character): localhost:5434
- Postgres (combat):    localhost:5435
- Redis:                localhost:6379

## Auth / Roles

1) Register a user (default role: `User`) on Account Service  
2) Login to get a JWT  
3) Use as `Authorization: Bearer <token>` for Character/Combat calls

A **GameMaster** user can be created by setting `role=GameMaster` at registration (see Postman collection).

## Postman collection

Import: `./postman/Zentrix-RPG.postman_collection.json`

The collection includes a happy path:
- register/login (User + GM)
- create class/items (GM)
- create characters (User)
- grant/gift items (GM / owner)
- challenge duel + actions

## Notes / Design decisions (task-friendly)

- **No cross-DB joins**. Services communicate via HTTP APIs.
- Each service runs **SQL migrations on startup** (tracked in `schema_migrations` table).
- Character `GET /api/character/:id` uses **Redis read-through cache** and is invalidated on inventory changes.
- Combat uses **snapshot-on-challenge**: it stores per-duel stats + current health in its own DB and applies cooldown rules.
- Combat calls Character Service internal endpoints secured with `X-Internal-Token`.

## Local dev (without Docker)

Each service can be run individually:
```bash
cd services/account-service && npm i && npm run dev
cd services/character-service && npm i && npm run dev
cd services/combat-service && npm i && npm run dev
```

Make sure Postgres/Redis env vars are set (see each service `.env.example`).

