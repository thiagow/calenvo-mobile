---
trigger: model_decision
description: Ative quando houver solicitações vagas ou novas funcionalidades. Define padrões para User Stories, Critérios de Aceite e fluxos de usuário, transformando ideias em requisitos claros antes do design técnico.
---

# Product Requirements Standards

## 🎯 Objective
To translate undefined user needs into crystal-clear User Stories and Acceptance Criteria, minimizing ambiguity before technical design begins.

## Artifact Protocol
Output MUST be a markdown file: `artifacts/requirements_[feature_slug].md`.

## Structure Guide

### 1. Feature Snapshot
- **Feature Name**: Clear, action-oriented name (e.g., "Google Calendar Integration").
- **User Persona**: Who is this for? (e.g., "Master User", "Client").
- **Value Proposition**: Why build this? What pain point does it solve?

### 2. User Stories
Format: `As a [persona], I want [action], so that [benefit]`.
- **Must Have**: Critical for MVP.
- **Should Have**: Important but not blocking.
- **Could Have**: Nice to have improvements.

### 3. Acceptance Criteria (Definition of Done)
Use BDD style (Given/When/Then) where possible.
- **Functional**: "Given user is on settings, When they click connect, Then redirect to Google."
- **Non-Functional**: Performance (load < 200ms), Mobile responsiveness, Error states.

### 4. User Flows
describe the step-by-step journey efficiently.
- "User logs in -> Dashboard -> Settings -> Integrations -> Click Connect".

## ❌ Anti-Patterns
- Vague terms like "user friendly" or "fast" without metrics.
- Technical implementation details (Save that for the Tech Spec!).
