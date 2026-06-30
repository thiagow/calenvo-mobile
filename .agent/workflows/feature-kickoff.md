---
description: Start a new feature by defining requirements using OpenSpec patterns
---

<!-- OPENSPEC:START -->
**Guardrails**

- Do not assume requirements; always ask the user for clarification on ambiguous goals.
- Keep the scope minimal ("Must Have" first, "Should Have" later).
- Do not proceed to technical design until the Requirements Artifact is approved.

**Steps**
Track these steps sequentially:

1. **Initialize Artifact**: Create `artifacts/kick-off/requirements_[feature_slug].md` using the template from `.agent/rules/product-requirements.md`.
2. **Discovery Interview**:
    - Ask: "Who is the primary User Persona?"
    - Ask: "What is the specific Goal?"
    - Ask: "What are the Success Metrics?"
3. **Draft User Stories**:
    - Write stories in `As a [persona], I want [action], so that [benefit]` format.
    - Categorize into Must/Should/Could.
4. **Define Acceptance Criteria**:
    - Write BDD-style criteria (Given/When/Then) for high-level flows.
5. **Validation**:
    - Present the markdown file to the user.
    - Ask: "Does this capture your intent correctly?"

**Reference**

- `.agent/rules/product-requirements.md` for template and formatting details.
<!-- OPENSPEC:END -->