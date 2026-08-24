# VidoraX Backend

Node.js API server for VidoraX, built with Express and TypeScript.

## Tech Stack

- Node.js
- Express 5
- TypeScript
- Supabase PostgreSQL (planned)
- Prisma ORM (planned)

## Prerequisites

- Node.js 20 LTS (or later)
- npm 10+
- Supabase project (for database setup)

## Getting Started

```bash
# From the backend directory
npm install
cp .env.example .env
npm run dev
```

The server starts at `http://localhost:3105` by default.

### Health Check

```bash
curl http://localhost:3105/api/health
```

## Project Structure

```
backend/
├── src/
│   ├── config/         # Environment and app configuration
│   ├── controllers/    # Request handlers
│   ├── routes/         # Route definitions
│   ├── middlewares/    # Express middleware
│   ├── services/       # Business logic layer
│   ├── repositories/   # Data access layer
│   ├── validators/     # Input validation
│   ├── utils/          # Shared utilities
│   ├── types/          # TypeScript type definitions
│   ├── app.ts          # Express application setup
│   └── server.ts       # Server entry point
├── .env.example
├── package.json
└── tsconfig.json
```

## Architecture

The backend follows a layered clean architecture:

```
Routes → Controllers → Services → Repositories → Database
```

- **Routes** define HTTP endpoints and map them to controllers.
- **Controllers** handle request/response orchestration.
- **Services** contain business logic (to be implemented).
- **Repositories** abstract data access (to be implemented).
- **Validators** enforce input schemas (to be implemented).

## Scripts

| Command            | Description                          |
| ------------------ | ------------------------------------ |
| `npm run dev`      | Start development server with reload |
| `npm run build`    | Compile TypeScript to `dist/`        |
| `npm start`        | Run compiled production server       |
| `npm run typecheck`| Type-check without emitting          |
| `npm run verify:avatar` | Contract-check the avatar endpoints |

## Environment Variables

| Variable       | Description                    | Default       |
| -------------- | ------------------------------ | ------------- |
| `NODE_ENV`     | Runtime environment            | `development` |
| `PORT`         | HTTP server port               | `3105`        |
| `DATABASE_URL` | Supabase PostgreSQL connection | —             |
| `SUPABASE_URL` | Supabase project URL, used for Storage | — |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key. **Server only** | — |
| `SUPABASE_AVATAR_BUCKET` | Storage bucket for avatars | `avatars` |
| `AVATAR_MAX_BYTES` | Server ceiling for an uploaded avatar | `2097152` |

## Profile Photo Storage

Avatars live in Supabase Storage, but the mobile app never holds storage
credentials. The API brokers every upload:

```
POST   /api/users/me/avatar/upload-url   → signed, single-object upload URL
PUT    <signed url>                      → client streams JPEG bytes to Storage
PUT    /api/users/me/avatar              → server verifies + persists avatarUrl
DELETE /api/users/me/avatar              → clears avatarUrl and deletes objects
```

Objects are stored as `avatars/{userId}-{timestamp}.jpg`. Because the filename
embeds the owner, the server can prove ownership from the path alone, and the
timestamp makes each object immutable and safely cacheable forever.

### Setup

1. In Supabase, open **Project Settings → API Keys** and copy the `service_role` key.
2. Add it to `backend/.env` as `SUPABASE_SERVICE_ROLE_KEY`, and set
   `SUPABASE_URL` to your project URL.
3. Restart the server. The `avatars` bucket is created on first use (public
   read, JPEG only, size-limited), so no manual bucket setup is required.

The service role key bypasses RLS. Keep it out of the mobile app, client
bundles, and version control.

## Planned Setup

The following will be configured in a future phase:

1. Initialize Prisma: `npx prisma init`
2. Connect `DATABASE_URL` to your Supabase PostgreSQL instance
3. Define schema and run migrations

## Related

- [Root README](../README.md)
- [Mobile README](../mobile/README.md)
- [Documentation](../docs/)
