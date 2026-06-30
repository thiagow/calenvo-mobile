---
trigger: model_decision
description: Ative antes de finalizar qualquer entrega. Define protocolos de evidências (logs/screenshots), scripts de verificação manual e padrões de testes unitários para garantir que nenhuma regressão seja introduzida.
---

# Testing & QA Standards

## 🎯 Objective
To drive development with a "Test-First" or "Verification-First" mindset, ensuring no regressions.

## 1. Evidence Artifacts
For any task involving logic or UI changes, you MUST produce evidence.
- **Logs**: `artifacts/logs/[task_id].log`.
- **Screenshots**: `artifacts/screenshots/[task_id].png` (via tool).

## 2. Manual Verification Script
If automated tests are missing, creating a script is mandatory.
- Create `scripts/verify-[feature].ts` using `tsx`.
- The script should simulate the user flow programmatically.
- **Example**: "Create user, Create Schedule, Book Appointment, Verify DB status".

## 3. Unit Testing (Jest/Vitest)
- **Scope**: Utilities (`lib/`), Hooks, and Complex Components.
- **Mocking**: Mock Database calls and Third-party APIs (Stripe, WhatsApp).
- **Naming**: `[filename].test.ts`.

## 4. Pre-Commit Checklist
Before marking a task as "Done":
1.  Run `npm run lint` (Static analysis).
2.  Run `npm run build` (Type checking + Build verification).
3.  Run validation script (Logic verification).
