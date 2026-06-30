---
description: Implement code following high quality standards and approved specs
---

<!-- OPENSPEC:START -->
**Guardrails**

- Favor straightforward, minimal implementations first.
- **Strictly follow** the approved `tech_spec` artifact. Do not invent new requirements.
- Verify every step with evidence (Types check, Lint, Logs).

**Steps**
Track these steps sequentially:

1. **Read Context**:
    - Read the approved `artifacts/tech-spec/tech_spec_[feature].md`.
    - Read `.agent/rules/coding-standards.md`.
2. **Foundation Phase**:
    - Implement Database changes (`prisma db push`).
    - Create/Update TypeScript Interfaces and Zod Schemas.
3. **Logic Phase (TDD preferred)**:
    - Create `scripts/verify-[feature].ts` to simulate the logic.
    - Implement Server Actions to pass the verification script.
4. **UI Implementation**:
    - specific components using logic from Phase 3.
    - Ensure `use client` is used only where necessary.
5. **Quality Check**:
    - Run `npm run lint`.
    - Run `npm run build` (to check for type errors).
    - Capture a Screenshot (if UI changed) or Log output (if logic).
6. **Finalize**:
    - Mark all items in the generic `task.md` or specific plan as `[x]`.
    - Create a "implementation_summary" markdown file `artifacts/implementation/`

**Reference**

- `.agent/rules/coding-standards.md`
- `.agent/rules/testing-standards.md`
<!-- OPENSPEC:END -->