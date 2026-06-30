# AGENTS.md - CalenvoApp Development Guide

**For agentic coding assistants working in this repository**

## 📋 Quick Reference

### Essential Commands

```bash
# Development
npm run dev                    # Start dev server (http://localhost:3000)
npm run build                  # Production build with type checking
npm run start                  # Start production server
npm run lint                   # Run ESLint

# Database
npx prisma generate           # Generate Prisma client
npx prisma db push            # Push schema changes (prototyping)
npx prisma migrate dev        # Create and apply migrations (production)
npx prisma studio             # Open Prisma Studio GUI

# Testing & Verification
node check_schedules.js       # Verify schedules in database
node check_users.js           # Verify users in database
tsx scripts/seed.ts           # Seed database with test data
```

### Running Tests

**Note**: No automated test framework is currently configured. Use manual verification:

- Create verification scripts in `scripts/verify-[feature].ts`
- Use `tsx` to run: `tsx scripts/verify-[feature].ts`
- Save test evidence to `docs/artifacts/logs/`

---

## 🏗️ Architecture Overview

### Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5.2 (strict mode)
- **Database**: PostgreSQL + Prisma ORM
- **Styling**: Tailwind CSS + Shadcn/UI
- **Auth**: NextAuth.js with Prisma adapter
- **State**: Zustand, Jotai, React Query
- **Forms**: react-hook-form + zod validation

### Project Structure

```
calenvoapp/
├── app/                    # Next.js App Router (pages + API routes)
│   ├── api/               # REST API endpoints
│   └── dashboard/         # Protected dashboard pages
├── components/            # React components (ui/ for Shadcn)
├── contexts/              # React Context providers
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities, services, business logic
├── prisma/               # Database schema and migrations
├── scripts/              # Automation and seed scripts
└── docs/                 # Documentation and artifacts
```

### Server vs Client Components

- **Default**: Server Components (data fetching, heavy computation)
- **Use `'use client'`**: Only for interactivity (state, events, browser APIs)
- **Pattern**: Pass data from Server Parent → Client Child via props

---

## 🎨 Code Style Guidelines

### 1. Naming Conventions

- **Files**: `kebab-case.tsx` or `kebab-case.ts`
- **Directories**: `kebab-case/`
- **Components**: `PascalCase` (e.g., `AppointmentCard`)
- **Functions/Variables**: `camelCase` (e.g., `handleSubmit`, `userName`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRY_ATTEMPTS`)
- **Interfaces/Types**: `PascalCase` (e.g., `AppointmentData`)

### 2. Import Order

```tsx
// 1. External dependencies
import { useState } from "react";
import { format } from "date-fns";

// 2. Internal dependencies (using @/ alias)
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/db";

// 3. Types
import type { Appointment } from "@prisma/client";
```

### 3. Component Structure

```tsx
'use client' // Only if needed

// Imports (see order above)

// Interface/Types
interface Props {
  data: Appointment;
  onCancel: (id: string) => void;
}

// Component
export function AppointmentCard({ data, onCancel }: Props) {
  // 1. Hooks (useState, useEffect, custom hooks)
  const [loading, setLoading] = useState(false);
  const { appointments } = useAppointments();

  // 2. Derived state/computations
  const isPast = new Date(data.date) < new Date();

  // 3. Event handlers
  const handleCancel = async () => {
    setLoading(true);
    try {
      await onCancel(data.id);
    } finally {
      setLoading(false);
    }
  };

  // 4. Render
  return (
    <div className={cn("p-4 border rounded", isPast && "opacity-50")}>
      {/* Component JSX */}
    </div>
  );
}
```

### 4. Styling (Tailwind + Shadcn)

- **Always use** `cn()` helper for conditional classes:

  ```tsx
  className={cn("p-4 border", isActive && "bg-primary", className)}
  ```

- **Use semantic tokens**: `bg-muted`, `text-destructive` (NOT `bg-gray-200`)
- **No inline styles**: Avoid `style={{ marginTop: 20 }}`
- **Responsive**: Use Tailwind breakpoints (`md:`, `lg:`)

### 5. TypeScript Standards

- **Strict mode**: No `any` type (use `unknown` if needed)
- **Explicit return types**: For complex functions
- **Shared types**: Move to `types/index.ts` if used in >1 file
- **Prisma types**: Import from `@prisma/client` when possible
- **Zod validation**: Required for all form inputs and API endpoints

---

## 🔒 API & Server Actions

### API Route Pattern (`app/api/*/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // 1. Authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Input validation (query params or body)
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // 3. Business logic
    const data = await prisma.appointment.findMany({
      where: { userId: session.user.id }
    });

    // 4. Response
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Server Actions (Preferred for Mutations)

- Must return: `{ success: boolean, data?: T, error?: string }`
- Always validate with `zod`
- Always check authentication with `getServerSession`

---

## 💾 Database (Prisma)

### Schema-First Approach

1. **Modify** `prisma/schema.prisma` first
2. **Run** `npx prisma db push` (prototyping) or `npx prisma migrate dev` (production)
3. **Generate** client: `npx prisma generate`

### Best Practices

- **Indexes**: Add `@@index` for foreign keys and frequently queried fields
- **Relations**: Be explicit, use `onDelete: Cascade` carefully
- **Transactions**: Use `prisma.$transaction()` for multi-step operations
- **Type safety**: Import types from `@prisma/client`

---

## ⚠️ Error Handling

```typescript
// API Routes
try {
  // ... logic
} catch (error) {
  console.error('Descriptive error message:', error);
  return NextResponse.json(
    { error: 'User-friendly message' },
    { status: 500 }
  );
}

// Client Components (with toast)
try {
  await someAction();
  toast.success('Success message');
} catch (error) {
  toast.error('Error message');
  console.error(error);
}
```

---

## 🚫 Anti-Patterns (Avoid These!)

- ❌ Using `any` type
- ❌ Inline styles (`style={{ ... }}`)
- ❌ Large components (>200 lines - break them down!)
- ❌ Magic numbers/strings (use named constants)
- ❌ Fetching data in `useEffect` (use Server Components or React Query)
- ❌ Prop drilling >3 levels (use Context/Zustand)
- ❌ Direct DB calls from Client Components
- ❌ Literal colors (`bg-blue-500` → use `bg-primary`)

---

## 📚 Additional Resources

### Important Files to Reference

- `.agent/rules/coding-standards.md` - Detailed coding standards
- `.agent/rules/architecture-standards.md` - Architecture patterns
- `.agent/rules/testing-standards.md` - Testing protocols
- `docs/feature-mapping.md` - Feature reference guide
- `prisma/schema.prisma` - Complete database schema

### Development Workflow

1. **Plan**: Consult existing patterns in `docs/feature-mapping.md`
2. **Design**: Follow `.agent/rules/architecture-standards.md`
3. **Implement**: Follow `.agent/rules/coding-standards.md`
4. **Verify**: Create verification script, run tests
5. **Document**: Save evidence to `docs/artifacts/`

### Pre-Commit Checklist

- [ ] Run `npm run lint` (no errors)
- [ ] Run `npm run build` (successful build)
- [ ] Test manually in browser if UX adjustments are made
- [ ] Create/update verification script if needed
- [ ] Document changes if architectural

---

**Last Updated**: January 2026  
**Project**: CalenvoApp - Scheduling & Appointment Management Platform
