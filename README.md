# VidoraX

Production-ready monorepo for the VidoraX Android application.

## Overview

VidoraX is organized as a monorepo with separate frontend and backend packages. The mobile client is built with React Native and Expo; the API is a Node.js and Express service backed by Supabase PostgreSQL and Prisma ORM.

## Repository Structure

```
VidoraX/
├── mobile/     # React Native (Expo) client
├── backend/    # Node.js + Express API
├── docs/       # Project documentation
├── design/     # Design assets and specifications
└── scripts/    # Shared automation scripts
```

## Tech Stack

| Layer    | Technologies                          |
| -------- | ------------------------------------- |
| Mobile   | React Native, Expo, TypeScript        |
| Backend  | Node.js, Express, TypeScript          |
| Database | Supabase PostgreSQL, Prisma ORM       |

## Prerequisites

- Node.js 20 LTS (or later)
- npm 10+
- Android Studio (for Android builds)
- Supabase account (for database setup)

## Getting Started

### Mobile

```bash
cd mobile
npm install
npx expo start
```

See [mobile/README.md](./mobile/README.md) for details.

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

See [backend/README.md](./backend/README.md) for details.

## Documentation

Project documentation lives in [docs/](./docs/).

## License

See [LICENSE](./LICENSE).
