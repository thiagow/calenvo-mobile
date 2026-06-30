# DOCUMENTO DE REQUISITOS: Notificações WhatsApp

## 🎯 1. Feature Snapshot

### **Feature Name**

Sistema de Notificações WhatsApp com Evolution API

### **User Personas**

- **Master User**: Gerencia o negócio e automatiza comunicações.
- **Professional**: Visualiza notificações vinculadas aos seus agendamentos.
- **Cliente Final**: Recebe notificações sobre seus agendamentos.

### **Value Proposition**

Automatizar a comunicação via WhatsApp para reduzir no-shows e melhorar a experiência do cliente, integrando CalenvoApp, Evolution API e n8n.

---

## 📝 2. User Stories

### **MUST HAVE (MVP)**

#### **US-01: Bloqueio por Plano (Free)**

- **Como** usuário Free, **quero** ver a seção de WhatsApp desabilitada, **para que** eu saiba que preciso do plano Standard+.
- **Critério**: Campos desabilitados e botão de Upgrade visível.

#### **US-02: Configuração de Instância (Standard+)**

- **Como** usuário Standard+, **quero** conectar meu WhatsApp via QR Code, **para que** o sistema envie mensagens em meu nome.
- **Critério**: Input de número -> Botão "Criar Instância" -> Exibição de QR Code -> Status "Conectado".

#### **US-03: Tipos de Notificações**

- **Confirmação**: Logo após o agendamento.
- **Cancelamento**: Logo após o cancelamento.
- **Confirmação de Presença**: X dias antes.
- **Lembrete**: X horas antes.
- **Critério**: Cada tipo possui toggle ON/OFF, campo de tempo (minutos/dias/horas) e mensagem customizável (max 120 chars).

#### **US-04: Variáveis Dinâmicas**

- Suporte a: `{{nome_cliente}}`, `{{data}}`, `{{hora}}`, `{{servico}}`, `{{profissional}}`, `{{empresa}}`.
- **Critério**: Preview em tempo real com valores de exemplo.

#### **US-05: Status em Tempo Real**

- **Critério**: Indicador visual (🔴/🟢) do status da conexão WhatsApp via webhooks da Evolution API.

---

## 🛣️ 3. User Flows

### **Fluxo de Conexão**

1. Usuário digita número WhatsApp.
2. Clica em "Criar Instância".
3. Sistema chama o N8N, que chama a Evolution API, e exibe QR Code.
4. Usuário escaneia e status atualiza para "Conectado".

### **Fluxo de Disparo**

1. Agendamento criado/cancelado.
2. CalenvoApp envia webhook para n8n com payload formatado.
3. n8n processa delay e variáveis.
4. n8n dispara mensagem via Evolution API.

---

## 📐 4. Modelo de Dados (WhatsAppConfig)

```prisma
model WhatsAppConfig {
  id                  String   @id @default(cuid())
  instanceName        String   @unique
  phoneNumber         String?
  isConnected         Boolean  @default(false)
  
  // Confirmação
  notifyOnCreate      Boolean  @default(true)
  createDelayMinutes  Int      @default(0)
  createMessage       String?  @db.Text
  
  // Cancelamento
  notifyOnCancel      Boolean  @default(true)
  cancelDelayMinutes  Int      @default(0)
  cancelMessage       String?  @db.Text
  
  // Presença
  notifyConfirmation  Boolean  @default(true)
  confirmationDays    Int      @default(1)
  confirmationMessage String?  @db.Text
  
  // Lembrete
  notifyReminder      Boolean  @default(true)
  reminderHours       Int      @default(2)
  reminderMessage     String?  @db.Text
  
  userId              String   @unique
  user                User     @relation(fields: [userId], references: [id])
}
```

---

## ✅ 5. Acceptance Criteria Globais

- Agendamento não deve falhar se o WhatsApp estiver fora do ar.
- Limite estrito de 120 caracteres para mensagens.
- Templates pré-preenchidos por padrão.
- Webhooks de status devem atualizar a UI sem refresh.

---
**Status:** 🟡 Aguardando Aprovação
**Data:** 23/01/2026
