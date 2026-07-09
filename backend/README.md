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

The server starts at `http://localhost:3000` by default.

### Health Check

```bash
curl http://localhost:3000/api/health
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

## Environment Variables

| Variable       | Description                    | Default       |
| -------------- | ------------------------------ | ------------- |
| `NODE_ENV`     | Runtime environment            | `development` |
| `PORT`         | HTTP server port               | `3000`        |
| `DATABASE_URL` | Supabase PostgreSQL connection | —             |

## Planned Setup

The following will be configured in a future phase:

1. Initialize Prisma: `npx prisma init`
2. Connect `DATABASE_URL` to your Supabase PostgreSQL instance
3. Define schema and run migrations

## Related

- [Root README](../README.md)
- [Mobile README](../mobile/README.md)
- [Documentation](../docs/)
