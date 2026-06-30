---
description: Execute rigorous QA, functional verification, and compliance review before delivery.
---
<!-- OPENSPEC:START -->
**Guardrails**
- NEVER skip linting or build verification.
- Evidence is mandatory: logs for logic, screenshots for UI.
- All documents (docs/features/, api-reference.md, etc.) MUST be synced with code changes.

**Steps**
Track these steps sequentially:

1.  **Static Analysis & Compilation**:
    - Run `npm run lint` and fix any issues.
    - Run `npm run build` to ensure type safety and successful compilation.

2.  **Functional Verification**:
    - Execute the specific verification script: `tsx scripts/verify-[feature].ts`.
    - If no script exists, create one following `.agent/rules/testing-standards.md`.
    - Capture and save results to `docs/artifacts/logs/[task_id].log`.

3.  **Compliance Audit**:
    - **Coding Standards**: Verify kebab-case, PascalCase for components, and use of `cn()` and semantic tokens.
    - **Architecture**: Check Server/Client boundaries, Zod validations, and Auth checks.
    - **Database**: Ensure `schema.prisma` changes are documented in `docs/data-models.md`.

4.  **Documentation Sync**:
    - Update `docs/feature-mapping.md` with new files/endpoints.
    - Update/Create the specific feature doc in `docs/features/[feature].md`.
    - Update `docs/api-reference.md` if new endpoints were added.

5.  **Final Evidence**:
    - Summarize verification results.
    - Ensure all items in the task/plan are marked as complete `[x]`.

**Reference**
- `.agent/rules/testing-standards.md`
- `.agent/rules/coding-standards.md`
- `.agent/rules/architecture-standards.md`
- `docs/feature-mapping.md`
<!-- OPENSPEC:END -->
