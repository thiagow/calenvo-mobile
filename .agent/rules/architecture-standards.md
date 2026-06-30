---
trigger: model_decision
description: Ative na fase de design técnico. Garante conformidade com o Next.js 14 e Prisma, definindo limites entre Server/Client components, padrões de banco de dados, segurança e design de APIs/Server Actions.
---

# Architecture & Design Standards

## 🎯 Objective
To ensure every feature implementation scales, maintains data integrity, and follows the project's established patterns (Next.js 14 + Prisma).

> **📚 Referência**: Consulte `docs/architecture-overview.md` para entender a arquitetura completa do sistema e `docs/data-models.md` para o schema Prisma documentado.

## Artifact Protocol
Output MUST be a markdown file: `artifacts/tech_spec_[feature_slug].md`.

## System Design Rules

### 1. Database & Schema (Prisma)
- **Schema-First**: All data changes MUST start with `prisma/schema.prisma`.
- **Relationships**: Prefer explicit relations. Use `Cascade` delete carefully.
- **Indexing**: Always add `@@index` for foreign keys and frequently queried fields.

### 2. Server vs Client Boundary
- **Server Components (Default)**: Fetching data, Metadata, Heavy computation.
- **Client Components (`use client`)**: Event listeners, State (`useState`), Browser APIs.
- **Pattern**: Pass data from Server Parent -> Client Child via props.

### 3. API & Server Actions
- **Server Actions**: Preferred for Mutations (POST/PUT/DELETE).
    - Must return standardized `{ success: boolean, data?: T, error?: string }`.
    - Must include `zod` validation for arguments.
- **Route Handlers (`app/api/`)**: Use for Webhooks or External consumers only.

### 4. Reliability & Security
- **Authentication**: Usage of `getServerSession` (NextAuth) is mandatory for protected actions.
- **Validation**: All inputs (Forms + API) must be validated with `zod`.
- **Error Handling**: Graceful degradation. Never expose stack traces to the UI.

## ❌ Anti-Patterns
- Fetching data inside `useEffect` (Use React Query or Server Comp instead).
- "Prop drilling" (Use Context/Zustand if > 3 levels).
- Direct database calls from Client Components (Impossible, but don't try via API proxy without auth).
