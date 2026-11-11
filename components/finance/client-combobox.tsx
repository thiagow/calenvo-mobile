'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronsUpDown, Loader2, UserRound, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface ClientOption {
  id: string
  name: string
  phone?: string | null
}

interface ClientComboboxProps {
  value: ClientOption | null
  onChange: (client: ClientOption | null) => void
  /** Permite limpar a escolha (venda sem cliente). */
  clearable?: boolean
  placeholder?: string
  id?: string
  className?: string
}

const MIN_CHARS = 2

/**
 * Busca de cliente por nome (no servidor, com debounce). Mostra só o necessário
 * para escolher: nome e telefone.
 */
export function ClientCombobox({ value, onChange, clearable = false, placeholder = 'Buscar cliente', id, className }: ClientComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(false)
  const requestId = useRef(0)

  useEffect(() => {
    if (!open) return
    const term = query.trim()
    if (term.length < MIN_CHARS) {
      setResults([])
      setLoading(false)
      return
    }
    const current = ++requestId.current
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clients?search=${encodeURIComponent(term)}`)
        const data: unknown = await res.json()
        // Ignora resposta de uma busca antiga (digitação rápida).
        if (current !== requestId.current) return
        setResults(
          Array.isArray(data)
            ? data.slice(0, 20).map((c: { id: string; name: string; phone?: string | null }) => ({ id: c.id, name: c.name, phone: c.phone ?? null }))
            : []
        )
      } catch {
        if (current === requestId.current) setResults([])
      } finally {
        if (current === requestId.current) setLoading(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query, open])

  return (
    <div className={cn('flex gap-1.5', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="min-h-11 flex-1 justify-between px-3 font-normal"
          >
            <span className={cn('flex min-w-0 items-center gap-2 truncate', !value && 'text-muted-foreground')}>
              <UserRound className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span className="truncate">{value?.name ?? placeholder}</span>
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 flex-shrink-0 opacity-50" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] min-w-64 p-0" align="start">
          {/* A busca é no servidor: o filtro local do cmdk fica desligado. */}
          <Command shouldFilter={false}>
            <CommandInput value={query} onValueChange={setQuery} placeholder="Digite o nome do cliente" />
            <CommandList>
              {query.trim().length < MIN_CHARS ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">Digite ao menos {MIN_CHARS} letras.</p>
              ) : loading ? (
                <p className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Buscando…
                </p>
              ) : results.length === 0 ? (
                <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
              ) : (
                results.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={client.id}
                    className="min-h-11"
                    onSelect={() => {
                      onChange(client)
                      setOpen(false)
                      setQuery('')
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value?.id === client.id ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{client.name}</span>
                      {client.phone && <span className="truncate text-xs text-muted-foreground">{client.phone}</span>}
                    </span>
                  </CommandItem>
                ))
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {clearable && value && (
        <Button type="button" variant="ghost" size="icon" className="h-11 w-11 flex-shrink-0" onClick={() => onChange(null)} aria-label="Remover cliente">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
