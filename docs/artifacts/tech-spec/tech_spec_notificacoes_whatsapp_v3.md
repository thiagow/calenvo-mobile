# DESIGN TÉCNICO v3.1: Notificações WhatsApp (Otimização e Estabilização)

**Data**: Fevereiro 03, 2026  
**Versão**: 3.1  
**Status**: ✅ Implementado  
**Autor**: AI Development Assistant  
**Base**: v3.0 (n8n Integration)

---

## 📋 Changelog v3.0 → v3.1

### **Principais Melhorias:**

| Aspecto | v3.0 | v3.1 (Atual) | Motivo |
|---------|------|-------------|---------|
| **Polling Interval** | 2 segundos | **30 segundos** | Redução drástica de carga no servidor n8n |
| **UX do Modal** | Vertical/Simples | **2 colunas / Responsivo** | Melhor visibilidade em telas menores, sem cortes |
| **Persistência** | Reset ao recarregar | **sessionStorage** | Modal mantém estado e QR Code após F5 |
| **Feedback Visual** | Nenhum | **Countdown regressivo** | Usuário sabe quando será o próximo check |
| **Endpoint QR** | `atualiza-qr-code` | `criar-instancia` | Unificação de fluxo no n8n |
| **Desconexão** | Update (Boolean) | **Hard DELETE** | Resolve bug visual de instâncias fantasmas |
| **Toasts** | Múltiplos/Spam | **Único + Delayed Reload** | Melhora fluxo de confirmação visual |

---

## 1. Arquitetura v3.1

### 1.1. Fluxo de Polling Otimizado
O polling agora é gerenciado pelo hook customizado `useStatusPolling`, que garante:
- Execução apenas quando o modal está aberto.
- Contador regressivo visual para o usuário.
- Detecção única de conexão para evitar múltiplos reloads.

### 1.2. Persistência de Estado (sessionStorage)
Para evitar que o usuário perca o progresso de conexão ao recarregar a página, o estado do modal é persistido:
- `whatsapp_qr_modal`: 'open' ou null
- `whatsapp_qr_code`: string base64

---

## 2. Especificações de UI (Otimizações)

### 2.1. QRCodeModal (2 Colunas)
- **Largura**: `sm:max-w-2xl` (Aumentada para acomodar layout horizontal).
- **Altura**: `max-h-[85vh]` com scroll automático.
- **QR Code**: Reduzido para `200x200px` para economizar espaço vertical.
- **Grid Layout**: Divide QR Code/Timer (Esquerda) de Instruções/Avisos (Direita).

### 2.2. Feedback de Status
- **Cores Neutras**: Segue o design system (`bg-muted/50`).
- **Animação**: `animate-pulse` durante a execução da chamada de status.
- **Reload Controlado**: Ocorre 1.5s após o toast de sucesso, garantindo que o usuário leia a confirmação.

---

## 3. Server Actions v3.1 (Implementação)

### 3.1. deleteInstanceAction
Agora realiza o delete físico do registro para garantir limpeza total:
```typescript
await prisma.whatsAppConfig.delete({
  where: { id: config.id },
});
```

### 3.2. Binary Detection (PNG)
A função `callN8nEndpoint` agora detecta binários PNG mesmo se o `Content-Type` estiver incorreto, convertendo automaticamente para Data URL:
```typescript
const isPNG = text.startsWith('\x89PNG') || text.charCodeAt(0) === 0x89;
if (isPNG) {
  const base64 = Buffer.from(text, 'binary').toString('base64');
  return { success: true, data: { qrCode: `data:image/png;base64,${base64}` } };
}
```

---

## 4. Variáveis de Ambiente v3.1

```env
# Endpoints Otimizados
N8N_CREATE_INSTANCE_URL=https://.../criar-instancia
N8N_STATUS_URL=https://.../status-da-instancia
N8N_DELETE_URL=https://.../excluir-instancia

# Unificação (v3.1)
N8N_UPDATE_QR_CODE_URL=https://.../criar-instancia
```

---

## 5. Riscos e Mitigações (Revisado)

| Risco | Probabilidade | Mitigação v3.1 |
|-------|--------------|-----------|
| Rate Limit n8n | Baixa | Intervalo aumentado para 30s |
| Perda de contexto no F5 | Média | Persistência via sessionStorage |
| Corte de UI em Laptops | Alta | Layout 2 colunas + max-height 85vh |
| Conflitos de Banco | Baixa | Hard delete garante estado limpo |

---

**Última Atualização**: Fevereiro 03, 2026  
**Versão**: 3.1  
**Status**: ✅ Implementado e Validado
