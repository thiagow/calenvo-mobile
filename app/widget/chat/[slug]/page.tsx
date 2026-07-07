'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { MessageCircle, X, Send, Loader2 } from 'lucide-react'

interface WidgetConfig {
  businessName: string
  enabled: boolean
  welcomeMessage: string
  primaryColor: string
  position: 'bottom-right' | 'bottom-left'
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

function postResizeMessage(open: boolean) {
  window.parent?.postMessage({ type: 'calenvo-widget-resize', open }, '*')
}

export default function ChatWidgetPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug

  const [config, setConfig] = useState<WidgetConfig | null>(null)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/widget/${slug}/config`)
      .then((r) => r.json())
      .then((data) => setConfig(data))
      .catch(() => setConfig(null))
  }, [slug])

  useEffect(() => {
    postResizeMessage(open)
  }, [open])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const handleOpen = () => {
    setOpen(true)
    if (config && messages.length === 0) {
      setMessages([{ role: 'assistant', content: config.welcomeMessage }])
    }
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return

    const nextMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch(`/api/widget/${slug}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.error || 'Não foi possível processar sua mensagem.' }])
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Erro de conexão. Tente novamente.' }])
    } finally {
      setLoading(false)
    }
  }

  if (config && !config.enabled) {
    return null
  }

  const primaryColor = config?.primaryColor || '#7C3AED'
  const isLeft = config?.position === 'bottom-left'

  return (
    <div
      className="fixed inset-0 flex flex-col justify-end pointer-events-none"
      style={{ alignItems: isLeft ? 'flex-start' : 'flex-end' }}
    >
      {!open ? (
        <button
          onClick={handleOpen}
          className="pointer-events-auto w-16 h-16 rounded-full shadow-lg flex items-center justify-center text-white transition-transform hover:scale-105"
          style={{ backgroundColor: primaryColor }}
          aria-label="Abrir chat"
        >
          <MessageCircle className="h-7 w-7" />
        </button>
      ) : (
        <div className="pointer-events-auto w-full h-full sm:w-[380px] sm:h-[600px] bg-white sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 text-white flex-shrink-0"
            style={{ backgroundColor: primaryColor }}
          >
            <span className="font-semibold text-sm">{config?.businessName || 'Atendimento'}</span>
            <button onClick={() => setOpen(false)} aria-label="Fechar chat">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                    m.role === 'user' ? 'text-white rounded-br-sm' : 'bg-white text-gray-800 rounded-bl-sm border border-gray-200'
                  }`}
                  style={m.role === 'user' ? { backgroundColor: primaryColor } : undefined}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 p-3 border-t border-gray-200 flex-shrink-0">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Digite sua mensagem..."
              className="flex-1 text-sm border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0 disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}
              aria-label="Enviar"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
