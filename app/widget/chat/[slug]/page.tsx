'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { MessageCircle, X, Send, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

const LAUNCHER_TEXT = 'Faça seu agendamento aqui.'
const AVATAR_SRC = '/chat-agent-avatar.jpg'

interface WidgetConfig {
  businessName: string
  enabled: boolean
  welcomeMessage: string
  primaryColor: string
  position: 'bottom-right' | 'bottom-left'
  showLauncherText: boolean
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  quickReplies?: string[]
}

function postResizeMessage(open: boolean, width?: number, height?: number) {
  window.parent?.postMessage({ type: 'calenvo-widget-resize', open, width, height }, '*')
}

function Avatar({ size, fallbackColor }: { size: number; fallbackColor: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div
        className="rounded-full flex items-center justify-center text-white flex-shrink-0"
        style={{ width: size, height: size, backgroundColor: fallbackColor }}
      >
        <MessageCircle style={{ width: size * 0.55, height: size * 0.55 }} />
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={AVATAR_SRC}
      alt="Atendente"
      onError={() => setFailed(true)}
      className="rounded-full object-cover flex-shrink-0"
      style={{ width: size, height: size }}
    />
  )
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
  const bubbleRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'
  }, [])

  useEffect(() => {
    fetch(`/api/widget/${slug}/config`)
      .then((r) => r.json())
      .then((data) => setConfig(data))
      .catch(() => setConfig(null))
  }, [slug])

  useEffect(() => {
    if (open) {
      postResizeMessage(true)
      return
    }
    const frame = requestAnimationFrame(() => {
      const width = bubbleRef.current?.scrollWidth || 64
      postResizeMessage(false, width, 64)
    })
    return () => cancelAnimationFrame(frame)
  }, [open, config?.showLauncherText])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const handleOpen = () => {
    setOpen(true)
    if (config && messages.length === 0) {
      setMessages([{ role: 'assistant', content: config.welcomeMessage }])
    }
  }

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text || loading) return

    const nextMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch(`/api/widget/${slug}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages.map(({ role, content }) => ({ role, content })) }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.error || 'Não foi possível processar sua mensagem.' }])
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply, quickReplies: data.quickReplies }])
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
  const showLauncherText = config?.showLauncherText ?? true
  const lastAssistantIndex = [...messages].map((m) => m.role).lastIndexOf('assistant')

  return (
    <div
      className="fixed inset-0 flex flex-col justify-end pointer-events-none"
      style={{ alignItems: isLeft ? 'flex-start' : 'flex-end' }}
    >
      {!open ? (
        <div
          ref={bubbleRef}
          className="pointer-events-auto flex items-center gap-2"
          style={{ flexDirection: isLeft ? 'row' : 'row-reverse' }}
        >
          <button
            onClick={handleOpen}
            className="w-16 h-16 rounded-full shadow-lg flex items-center justify-center overflow-hidden text-white transition-transform hover:scale-105 flex-shrink-0"
            style={{ backgroundColor: primaryColor }}
            aria-label="Abrir chat"
          >
            <Avatar size={64} fallbackColor={primaryColor} />
          </button>
          {showLauncherText && (
            <button
              onClick={handleOpen}
              className="bg-white text-gray-800 text-sm font-medium px-4 py-2.5 rounded-2xl shadow-lg whitespace-nowrap hover:shadow-xl transition-shadow"
            >
              {LAUNCHER_TEXT}
            </button>
          )}
        </div>
      ) : (
        <div className="pointer-events-auto w-full h-full sm:w-[380px] sm:h-[600px] bg-white sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 text-white flex-shrink-0"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Avatar size={32} fallbackColor={primaryColor} />
              <span className="font-semibold text-sm truncate">{config?.businessName || 'Atendimento'}</span>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Fechar chat" className="flex-shrink-0">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && <Avatar size={24} fallbackColor={primaryColor} />}
                <div className="flex flex-col gap-2 max-w-[80%]">
                  <div
                    className={`rounded-2xl px-4 py-2 text-sm ${
                      m.role === 'user' ? 'text-white rounded-br-sm' : 'bg-white text-gray-800 rounded-bl-sm border border-gray-200'
                    }`}
                    style={m.role === 'user' ? { backgroundColor: primaryColor } : undefined}
                  >
                    {m.role === 'assistant' ? (
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>,
                          li: ({ children }) => <li>{children}</li>,
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                          a: ({ children, href }) => (
                            <a href={href} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: primaryColor }}>
                              {children}
                            </a>
                          ),
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    ) : (
                      m.content
                    )}
                  </div>

                  {m.role === 'assistant' && i === lastAssistantIndex && m.quickReplies && m.quickReplies.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {m.quickReplies.map((option, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSend(option)}
                          disabled={loading}
                          className="text-xs font-medium px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50"
                          style={{ borderColor: primaryColor, color: primaryColor }}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 justify-start">
                <Avatar size={24} fallbackColor={primaryColor} />
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
              onClick={() => handleSend()}
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
