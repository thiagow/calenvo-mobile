# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Calenvo** — SaaS appointment scheduling platform for service businesses (salons, barbershops, clinics, consultants). Multi-tenant, multi-professional, with WhatsApp automation, loyalty programs, Stripe payments, and a public booking page per business.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 (strict) |
| Database | PostgreSQL via Prisma 6.7 |
| Auth | NextAuth.js 4 |
| UI | Shadcn/UI + Radix UI + Tailwind CSS |
| State | Zustand + Jotai + React Query + SWR |
| Animations | Framer Motion |
| Forms | react-hook-form + Zod |
| Deployment | Netlify |
| Notifications | n8n webhooks → WhatsApp |
| Payments | Stripe |

## Commands

```bash
# Development
npm run dev           # Start dev server on :3000

# Production build (also runs prisma generate)
npm run build

# Database
npx prisma studio            # GUI for the DB
npx prisma migrate dev       # Apply migrations in dev
npx prisma db push           # Push schema without migration history
npx prisma generate          # Regenerate Prisma client after schema changes

# Seed
npx tsx scripts/seed.ts

# Lint
npm run lint
```

No automated test suite — verification is done via manual scripts in `/scripts/` run with `npx tsx scripts/<script>.ts`.

## Architecture

### Route structure

```
/app
  /dashboard/*           Protected pages (requires auth)
  /booking/[slug]/*      Public booking pages (per-business slug)
  /login, /signup        Auth pages
  /saas-admin            Platform administration
  /api/*                 REST API endpoints
```

All API routes follow: **auth → validation → logic → response**.

### Data flow

- **Server Components** handle data fetching and DB access by default.
- **`'use client'`** components are reserved for interactivity, forms, and real-time state.
- **`/lib/db.ts`** is the singleton Prisma client — never instantiate Prisma elsewhere.
- **`/lib/api.ts`** contains shared API utilities.
- **`/lib/auth-options.ts`** holds the full NextAuth configuration.

### Key domain models (Prisma)

`User` → owns a business → has `Schedule` configs, `Service` catalog, `Client` list, `Appointment` records. `WhatsAppConfig` and `LoyaltyConfig` hang off `User`. Appointments track status transitions and can have `AppointmentPackageUsage`.

### WhatsApp / n8n

All WhatsApp automation flows through n8n webhooks. Environment variables `N8N_WEBHOOK_URL`, `N8N_CREATE_INSTANCE_URL`, etc. control which n8n instance is targeted. The service layer lives in `/lib/whatsapp-service.ts`.

### Multi-tenancy

Each business is a `User` record with a unique `slug`. Public booking uses `/booking/[slug]` routes. Dashboard is scoped to the authenticated user's own data via session.

## Environment variables

Required in `.env.local`:

```
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Optional (features degrade gracefully without them):
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_STANDARD_PRICE_ID`
- `N8N_WEBHOOK_URL`, `N8N_CREATE_INSTANCE_URL`, `N8N_UPDATE_QR_CODE_URL`, `N8N_STATUS_URL`, `N8N_DELETE_URL`
- `AWS_REGION`, `AWS_BUCKET_NAME` (file uploads)

Copy `.env.example` for the full list.

## Code conventions

- **Files**: `kebab-case.ts` / `kebab-case.tsx`
- **Components**: `PascalCase`; exported default at bottom
- **Functions/hooks**: `camelCase`
- **Imports**: external packages → internal paths → types
- **No `any`** — use `unknown` or proper generics
- **Conditional classes**: always use the `cn()` utility (`lib/utils.ts`), never string concatenation
- **Error handling**: try/catch in API routes; surface to user via toast, log to `ErrorLog` model for critical failures
- **Shadcn components** live in `/components/ui/` — never edit them directly, extend via wrapper components

## Netlify build

The build command on Netlify is `npx -y prisma@6.7.0 generate && next build`. The `next.config.js` intentionally suppresses TypeScript and ESLint errors during build (`ignoreBuildErrors: true`) — fix errors locally before pushing, don't rely on build-time gates.

## Documentation

- `/AGENTS.md` — additional AI assistant dev guide
- `/.agent/rules/` — coding standards, architecture patterns, feature navigation
- `/docs/` — API reference, data models, feature mapping
