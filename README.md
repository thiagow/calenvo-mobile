# Calenvo App
![Status](https://img.shields.io/badge/status-active-success.svg) ![Next.js](https://img.shields.io/badge/Next.js-14.2-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue)

## 📋 Overview
**Calenvo App** is a high-performance scheduling and availability management platform built for service businesses (salons, barbershops, clinics, consultants) to connect with their clients. It handles the hard parts of scheduling — multi-professional shifts, custom working days, time-off blocks, and double-booking prevention — behind a clean, responsive interface.

Built on a modern, multi-tenant architecture, the system prioritizes data integrity and user experience, using hybrid rendering (SSR/CSR) for SEO and performance. On top of the core booking engine, Calenvo ships two client-facing automation layers that set it apart: **WhatsApp notifications** that keep clients and professionals in sync automatically, and an **AI-powered booking chat** that lets clients schedule an appointment by simply chatting, with no forms involved.

## 🏗 Architecture & Design
The project follows a component- and service-based architecture using the **Next.js App Router**:

*   **Frontend**: React with functional components and custom Hooks (`hooks/`). The UI is built with **Tailwind CSS** and **Shadcn/UI** for visual consistency.
*   **Backend**: Next.js API Routes serve as the backend layer, talking to the database through **Prisma ORM**.
*   **State Management**: Uses `zustand` and `jotai` for lightweight, reactive global state, plus `React Query`/`SWR` for data fetching and caching.
*   **Authentication**: Implemented with **NextAuth.js**, providing secure, persistent sessions via the Prisma adapter.
*   **Design Patterns**:
    *   *Adapter Pattern*: for third-party integrations (AWS S3, Stripe, n8n).
    *   *Compound Components*: for complex UI elements.
    *   *Repository/Service*: database logic isolated in the `lib/` and `prisma/` directories.

## 🔔 WhatsApp Notifications
Every appointment lifecycle event can trigger an automated WhatsApp message to the client — and, where relevant, to the professional — without any manual follow-up from the business owner.

*   **How it works**: the app never talks to WhatsApp directly. `lib/whatsapp-trigger.ts` builds the outgoing message and posts it to an **n8n** webhook, which owns the actual WhatsApp connection (via Evolution API) and delivers the message. Sends use exponential backoff retries, and a dispatch queue / throttle layer (`lib/whatsapp-dispatch-queue.ts`, `lib/whatsapp-throttle.ts`) protects against rate-limit bans on the WhatsApp side.
*   **Events covered**:
    *   **New appointment** — confirmation sent to the client right after booking.
    *   **Cancellation** — the client is notified when the business cancels; the professional is notified when the client cancels their own appointment (self-service, via public booking or the AI chat).
    *   **Attendance confirmation request** — sent a configurable number of days before the appointment, with a secure link (`/c/<token>`) the client taps to confirm they're still coming.
    *   **Reminder** — a follow-up message shortly before the appointment time.
    *   **Completion** — sent after the appointment is marked done, optionally including a review/feedback link.
*   **Customizable templates**: each business configures its own message templates per event (`WhatsAppConfig`), with mustache-style variables — `{{nome_cliente}}`, `{{data}}`, `{{hora}}`, `{{servico}}`, `{{profissional}}`, `{{empresa}}`, `{{link_confirmacao}}`, `{{link_avaliacao}}` — and can turn each notification type on or off independently. Everything degrades gracefully: if WhatsApp isn't connected for a business, the rest of the app keeps working normally.

## 🤖 AI Scheduling Chat
Calenvo includes an embeddable chat widget, powered by an LLM (OpenAI, `lib/ai/chat-agent.ts`), that lets a business's clients book, look up, or cancel an appointment through natural conversation instead of filling out a booking form.

*   **Where it lives**: a floating widget embeddable on any page (`app/widget/chat/[slug]/page.tsx`), served through a per-business route at `/api/widget/[slug]/chat`, and configurable from the dashboard (`app/dashboard/chat-widget`) — welcome message, avatar, brand color, widget position, and enabled/disabled state.
*   **What it can do**: the agent runs a tool-calling loop with function access to the real scheduling engine, so it never hallucinates availability or invents appointment data:
    *   `list_services` — lists the business's services and which professionals attend each one (the client never needs to know or choose a schedule — the system resolves that automatically).
    *   `check_availability` — checks real open slots for a service on a given date, optionally scoped to one professional.
    *   `create_appointment` — books the appointment once the client has confirmed service, date, time, and contact details, going through the same double-booking-safe path (`withBookingLock`) used everywhere else in the app.
    *   `list_my_appointments` / `cancel_appointment` — lets a client look up and cancel their own upcoming appointments by phone number, respecting each business's self-cancellation policy (allowed/disallowed, minimum notice window).
*   **Safety rails**: the agent is timezone-aware per business, refuses past dates, is capped at a bounded number of availability checks per conversation to avoid runaway tool loops, and enforces each business's appointment quota before booking.
*   **Requires** an `OPENAI_API_KEY` (see [Environment Variables](#-environment-variables)); the feature degrades gracefully and reports itself as unavailable when the key isn't set.

## ⚙️ Installation

### Prerequisites
*   Node.js v20.x or higher
*   A package manager (`npm`, `yarn`, or `pnpm`)
*   PostgreSQL (local or remote instance)

### Step by step

1.  **Clone the repository**
    ```bash
    git clone https://github.com/thiagow/calenvoapp.git
    cd calenvoapp
    ```

2.  **Install dependencies**
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Configure the environment**
    Create a `.env.local` file at the project root:
    ```env
    DATABASE_URL="postgresql://user:password@localhost:5432/calenvo"
    NEXTAUTH_SECRET="your_secret_key"
    NEXTAUTH_URL="http://localhost:3000"
    NEXT_PUBLIC_APP_URL="http://localhost:3000"
    # Add the optional keys below as needed (Stripe, AWS, n8n/WhatsApp, OpenAI)
    ```

4.  **Sync the database**
    ```bash
    npx prisma generate
    npx prisma db push
    ```

## 🔑 Environment Variables

Required in `.env.local`:

```
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Optional (each feature degrades gracefully without its keys):
*   `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_STANDARD_PRICE_ID` — billing/subscriptions.
*   `N8N_WEBHOOK_URL`, `N8N_CREATE_INSTANCE_URL`, `N8N_UPDATE_QR_CODE_URL`, `N8N_STATUS_URL`, `N8N_DELETE_URL` — WhatsApp automation via n8n.
*   `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL` (defaults to `gpt-4o-mini`) — powers the AI scheduling chat widget.
*   `AWS_REGION`, `AWS_BUCKET_NAME` — file uploads.

See `.env.example` for the full list.

## 📖 Usage Guide

### Local Development
To start the dev server with hot-reload:

```bash
npm run dev
```
Visit: [http://localhost:3000](http://localhost:3000)

### Database Tools
```bash
npx prisma studio            # DB GUI
npx prisma migrate dev       # Apply migrations in dev
npx prisma db push           # Push schema without migration history
```

### Seed
```bash
npx tsx scripts/seed.ts
```

### Production Build
```bash
npm run build
npm start
```

## 📂 Directory Structure

```plaintext
calenvoapp/
├── app/                  # Routes, pages, and APIs (Next.js App Router)
│   ├── api/              # REST API endpoints (incl. the AI chat widget API)
│   ├── dashboard/        # Protected pages (requires auth)
│   ├── booking/[slug]/   # Public per-business booking pages
│   └── widget/chat/      # Embeddable AI scheduling chat widget
├── components/           # Reusable UI component library
│   ├── ui/               # Base components (Shadcn)
│   └── schedule/         # Scheduling-specific components
├── contexts/             # React Context providers (global state)
├── hooks/                # Custom React Hooks
├── lib/                  # Utilities, config, and business logic
│   ├── ai/               # AI scheduling chat agent
│   ├── whatsapp-*.ts     # WhatsApp notification triggers, dispatch queue, throttling
│   └── ...
├── prisma/               # Database schema and migrations
├── public/               # Static assets (images, fonts)
└── scripts/              # Automation and maintenance scripts
```

## 🤝 Contributing & Testing

### Code Standards
The project uses ESLint and Prettier to keep code quality consistent.

```bash
# Run the linter
npm run lint
```

### Tests
Unit tests live alongside the code as `*.test.ts` (Vitest) and run with:

```bash
npm test
```

`.github/workflows/typecheck.yml` runs `npx tsc --noEmit` and `npm test` on every push/PR to `master`. Manual verification scripts in `/scripts/` (run with `npx tsx scripts/<script>.ts`) cover one-off checks that don't fit a unit test.
