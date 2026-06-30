---
trigger: model_decision
description: Ative durante a escrita de código. Define convenções de nomenclatura (kebab-case), estrutura de componentes React, uso estrito de TypeScript e padrões de estilização com Tailwind/Shadcn para manter consistência.
---

# Coding & Implementation Standards

## 🎯 Objective
To maintain a codebase that is readable, maintainable, and uniform, regardless of which agent writes it.

> **📚 Importante**: Antes de implementar qualquer feature, consulte `docs/feature-mapping.md` para localizar padrões e referências existentes. Veja `.agent/rules/feature-navigation.md` para o protocolo completo.

## 1. Naming Conventions
- **Directories**: `kebab-case` (e.g., `components/scheduling-flow/`).
- **Files**: `kebab-case.tsx` or `kebab-case.ts`.
- **Components**: `PascalCase` (e.g., `AppointmentCard`).
- **Functions/Vars**: `camelCase`.
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRY_ATTEMPTS`).

## 2. Component Structure
```tsx
// Imports (External -> Internal -> Styles)
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Interface
interface Props {
  data: Appointment;
  onCancel: (id: string) => void;
}

// Component
export function AppointmentCard({ data, onCancel }: Props) {
  // 1. Hooks
  const [loading, setLoading] = useState(false);

  // 2. Derived State
  const isPast = new Date(data.date) < new Date();

  // 3. Handlers
  const handleCancel = async () => { ... }

  // 4. Render
  return ( ... );
}
```

## 3. Styling (Tailwind + Shadcn)
- **Utility-First**: Use Tailwind classes for layout, spacing, and colors.
- **Conditionals**: ALWAYS use `cn()`: `className={cn("p-4", isActive && "bg-primary")}`.
- **Tokens**: Use semantic colors (`bg-muted`, `text-destructive`) not literals (`bg-gray-200`).

## 4. TypesScript
- **Strict**: No `any`.
- **Shared Types**: If used in >1 file, move to `types/index.ts` or `@prisma/client`.
- **Return Types**: Explicitly type complex function returns.

## ❌ Anti-Patterns
- Inline styles (`style={{ marginTop: 20 }}`).
- Large components (> 200 lines). Break them down!
- "Magic numbers" or "Magic strings" (Use constants).
