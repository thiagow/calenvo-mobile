---
description: Create strict technical design specifications before coding
---

<!-- OPENSPEC:START -->
**Guardrails**

- **Do not write code** during the proposal/spec stage.
- Always check `prisma/schema.prisma` for data model impact.
- Ensure the design aligns with `.agent/rules/architecture-standards.md`.

**Steps**
Track these steps sequentially:

1. **Initialize Artifact**: Create `artifacts/tech-spec/tech_spec_[feature_slug].md`.
2. **Constraint Analysis**:
    - Review `architecture-standards.md`.
    - Check for breaking changes in the DB or API.
3. **Schema Design**:
    - Draft Prisma model changes (if any).
    - Validate relationships and indexing strategy.
4. **Interface Design**:
    - Define Server Actions signatures (Input/Output).
    - Define Zod schemas for validation.
5. **Component Architecture**:
    - List new UI components.
    - Decide: Server vs Client Component logic.
6. **Implementation Plan**:
    - List detailed development steps (e.g., "1. Migration", "2. Seed", "3. Action", "4. UI").
7. **Review**:
    - Present the Technical Spec to the user for approval.

**Reference**

- `.agent/rules/architecture-standards.md` for patterns.
- `prisma/schema.prisma` for current DB state.
<!-- OPENSPEC:END -->