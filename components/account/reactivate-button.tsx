'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'
import { Loader2, CreditCard } from 'lucide-react'

export function ReactivateButton() {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao abrir portal de pagamento')
      }

      window.location.href = data.url
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao abrir portal de pagamento')
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      className="w-full bg-[#7C3AED] hover:bg-violet-700 text-white text-lg py-6"
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Abrindo portal de pagamento...
        </>
      ) : (
        <>
          <CreditCard className="mr-2 h-5 w-5" />
          Atualizar Pagamento
        </>
      )}
    </Button>
  )
}
