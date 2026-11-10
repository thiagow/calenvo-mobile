'use client'

import { useState } from 'react'
import { Loader2, Lock, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { financeFetch, type CategoryKind, type FinanceCategoryDto } from './types'

const KINDS: { value: CategoryKind; label: string }[] = [
  { value: 'INCOME', label: 'Receitas' },
  { value: 'EXPENSE', label: 'Despesas' }
]

interface CategoriesCardProps {
  categories: FinanceCategoryDto[]
  onChanged: () => void
}

export function CategoriesCard({ categories, onChanged }: CategoriesCardProps) {
  const [kind, setKind] = useState<CategoryKind>('EXPENSE')
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const visible = categories.filter((c) => c.kind === kind)

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    try {
      await financeFetch('/api/finance/categories', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), kind })
      })
      setNewName('')
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível criar a categoria')
    } finally {
      setAdding(false)
    }
  }

  const toggle = async (category: FinanceCategoryDto) => {
    setPendingId(category.id)
    try {
      await financeFetch(`/api/finance/categories/${category.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !category.isActive })
      })
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível atualizar a categoria')
    } finally {
      setPendingId(null)
    }
  }

  return (
    <Card className="border border-border">
      <CardContent className="space-y-4 p-4">
        <div role="tablist" aria-label="Tipo de categoria" className="grid grid-cols-2 rounded-lg bg-muted p-1">
          {KINDS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={kind === option.value}
              onClick={() => setKind(option.value)}
              className={cn(
                'rounded-md py-1.5 text-sm font-medium transition-all',
                kind === option.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <ul className="flex flex-wrap gap-1.5" aria-label="Categorias">
          {visible.map((category) => (
            <li key={category.id}>
              <button
                type="button"
                disabled={category.isSystem || pendingId === category.id}
                onClick={() => toggle(category)}
                title={
                  category.isSystem
                    ? 'Usada nos lançamentos automáticos'
                    : category.isActive
                      ? 'Toque para desativar'
                      : 'Toque para reativar'
                }
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  category.isActive
                    ? 'border-border bg-background text-foreground hover:border-foreground/30'
                    : 'border-dashed border-border bg-transparent text-muted-foreground line-through',
                  category.isSystem && 'cursor-default hover:border-border'
                )}
              >
                {category.isSystem && <Lock className="h-3 w-3 text-muted-foreground" aria-label="Categoria do sistema" />}
                {category.name}
              </button>
            </li>
          ))}
        </ul>

        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={kind === 'INCOME' ? 'Nova categoria de receita' : 'Nova categoria de despesa'}
            maxLength={60}
            aria-label="Nome da nova categoria"
          />
          <Button
            type="submit"
            size="icon"
            variant="outline"
            disabled={adding || !newName.trim()}
            aria-label="Adicionar categoria"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </form>
        <p className="text-[11px] text-muted-foreground">
          Categorias com cadeado recebem os lançamentos automáticos e não podem ser desativadas.
        </p>
      </CardContent>
    </Card>
  )
}
