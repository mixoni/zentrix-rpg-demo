# Zentrix RPG – Backend Microservices Demo

This repository contains a small RPG backend system implemented as three independent services:

- **Account Service** – authentication and JWT issuing
- **Character Service** – characters, classes, items, inventory, caching
- **Combat Service** – duels, actions, cooldowns, timeout, loot resolution

The project is intentionally **backend-only**.
All functionality is verified via a Postman collection.

---

## Tech Stack

- **Node.js + TypeScript** (Fastify)
- **PostgreSQL** (separate database per service)
- **Redis** (caching)
- **Docker Compose** (local setup)

---

## Architecture Overview

- Each service owns its **own database schema**
- Services communicate exclusively via **HTTP APIs**
- JWT is used for authentication and role-based authorization
- Combat service works on **snapshots** of character stats to avoid tight coupling
- Redis is used to cache character details and is invalidated on mutations

This structure mirrors real-world microservice boundaries while remaining simple enough for an MVP.

---

## Running the System Locally

From the repository root:

```bash
docker compose up --build
```

This will start:
- Account Service (`:3001`)
- Character Service (`:3002`)
- Combat Service (`:3003`)
- PostgreSQL databases
- Redis

Health checks:
- `GET http://localhost:3001/health`
- `GET http://localhost:3002/health`
- `GET http://localhost:3003/health`

To reset everything (fresh databases):

```bash
docker compose down -v
```

---

## Configuration Notes

Configuration is provided via `docker-compose.yml`.

Important variables:
- `JWT_SECRET` – used across services for JWT verification
- `INTERNAL_TOKEN` – simple service-to-service authentication
- `CHARACTER_SERVICE_URL` – Combat → Character communication
- `REDIS_URL` – Character cache

### Duel Timeout
- Default duel timeout is **5 minutes** (as required by the task)
- For demo/testing purposes this can be overridden:
  - `DUEL_TIMEOUT_MS` (e.g. `30000` for 30 seconds)

Timeouts are enforced server-side.

---

## Database Migrations & Seeding

- Each service runs its own migrations on startup
- Character Service seeds initial reference data (e.g. character classes)

No manual database setup is required.

---

## Verifying the System (Postman)

The entire system is verified via a **Postman collection**.

### Importing the Collection

1. Open **Postman**
2. Click **Import**
3. Select:
   `postman/Zentrix-RPG.postman_collection.json`
4. Import

No Postman environment is required.

---

## Important: Execution Order

⚠️ **The execution order of requests matters.**

The Postman collection uses **pre-request and post-response scripts** to automatically manage variables required by subsequent requests.

These scripts:
- store JWT tokens after login
- store created character IDs
- store duel IDs after challenge creation

Because of this, requests must be executed **in the intended order**.

### Typical Flow

1. **Account**
   - Register User
   - Register GameMaster
   - Login User → sets `userToken`
   - Login GameMaster → sets `gmToken`

2. **Character**
   - Create first character (Hero A) → sets `charA`
   - Create second character (Hero B) → sets `charB`
   - (Optional) Create and grant items

3. **Combat**
   - Challenge duel → sets `duelId`
   - Perform actions (attack / cast / heal)

All required IDs and tokens are propagated automatically between requests.
No manual copy/paste is needed.

---

## Combat Behavior Notes

- Actions are restricted to duel participants
- Cooldowns are enforced server-side:
  - Attack: 1 second
  - Cast / Heal: 2 seconds
- If a duel exceeds the configured timeout, it is resolved as a **Draw**
- On draw, no loot is transferred
- On victory, a random item is transferred from the defeated character

Timeout handling is demonstrated via the Postman collection by waiting beyond the timeout window and then attempting an action.

---

## Design Intent

This project focuses on:
- clear service boundaries
- ownership of data per service
- realistic backend workflows
- testability without a UI
- avoiding unnecessary overengineering

The goal is to demonstrate **system design and backend reasoning**, not to build a full game.

---

## License

Internal demo / take-home assignment project.
