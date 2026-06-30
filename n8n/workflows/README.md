# Workflows N8N — Calenvo

Este diretório contém os workflows N8N para integração WhatsApp e Agente de IA.

## Workflows

### 1. Evolution QR Code (`Evolution QR Code.json`)
Gerencia instâncias WhatsApp via Evolution API.

**Endpoints:**
- `status-da-instancia` - Verifica status da conexão
- `criar-instancia` - Cria nova instância e retorna QR Code
- `excluir-instancia` - Remove instância
- **`habilitar-webhook`** ⚠️ *A adicionar* - Habilita/desabilita webhook para agente IA

**Documentação:** Ver `HABILITAR_WEBHOOK_NODES.md` para instruções de como adicionar o endpoint `habilitar-webhook`.

---

### 2. Disparo Mensagens Calenvo (`disparo-mensagens-calenvo.json`)
Workflow agendado para envio de lembretes de agendamentos.

**Execução:** Diariamente às 8h
**Função:** Busca agendamentos do dia no PostgreSQL e envia lembretes via Evolution API

---

### 3. Agente IA Agendamento (`agente-ia-agendamento-calenvo.json`)
Agente de IA para atendimento automático via WhatsApp.

**Trigger:** Webhook recebendo eventos `MESSAGES_UPSERT` da Evolution API
**Função:** Responde mensagens de clientes, consulta disponibilidade e cria agendamentos automaticamente

**Documentação completa:** Ver `AI_AGENT_TOOLS.md`

**Arquivos de suporte:**
- `tool-slots-disponiveis.js` - Lógica de cálculo de horários disponíveis
- `tool-criar-agendamento.js` - Lógica de criação de agendamento com cliente

---

## Variáveis de Ambiente Necessárias

Adicionar ao `.env`:

```env
# Evolution API
EVOLUTION_API_URL=https://evolution-evolution-api.feidcm.easypanel.host
EVOLUTION_API_KEY=Wh4Hgf19Kb1YEp41eQB8j8gLLqMiSMgX

# N8N Webhooks
N8N_SEND_MESSAGE_URL=https://n8n.seudominio.com/webhook/enviar-mensagem
N8N_WEBHOOK_TOGGLE_URL=https://n8n.seudominio.com/webhook/habilitar-webhook
N8N_AI_AGENT_WEBHOOK_URL=https://n8n.seudominio.com/webhook/agente-ia-calenvo

# OpenAI (para o agente)
OPENAI_API_KEY=sk-...
```

---

## Deploy

### Workflow "Evolution QR Code"
1. Importar JSON no n8n
2. Adicionar manualmente os nós do endpoint `habilitar-webhook` (ver `HABILITAR_WEBHOOK_NODES.md`)
3. Ativar workflow
4. Copiar URL do webhook `habilitar-webhook` e adicionar ao `.env` como `N8N_WEBHOOK_TOGGLE_URL`

### Workflow "Agente IA Agendamento"
1. Importar JSON no n8n
2. Configurar credenciais PostgreSQL
3. Configurar credenciais OpenAI
4. Adicionar manualmente o nó OpenAI Agent com as 7 tools (ver `AI_AGENT_TOOLS.md`)
5. Adicionar nó Evolution API para enviar resposta
6. Ativar workflow
7. Copiar URL do webhook e adicionar ao `.env` como `N8N_AI_AGENT_WEBHOOK_URL`

---

## Fluxo Completo do Agente IA

```
Cliente envia mensagem WhatsApp
  ↓
Evolution API recebe mensagem
  ↓
Evolution API envia webhook MESSAGES_UPSERT para n8n
  ↓
N8N: Workflow "Agente IA Agendamento"
  ├─ Extrai dados (instanceName, telefone, mensagem)
  ├─ Busca tenant no PostgreSQL
  ├─ Verifica se AI Agent está habilitado
  ├─ OpenAI Agent processa mensagem
  │   ├─ Tool: Info da Empresa
  │   ├─ Tool: Consultar Serviços
  │   ├─ Tool: Consultar Agendas
  │   ├─ Tool: Consultar Slots Disponíveis
  │   ├─ Tool: Criar Agendamento (cria cliente se não existir)
  │   ├─ Tool: Consultar Agendamentos do Cliente
  │   └─ Tool: Cancelar Agendamento
  └─ Envia resposta do agente via Evolution API
  ↓
Cliente recebe resposta no WhatsApp
```

---

## Troubleshooting

### Agente não responde mensagens
1. Verificar se `aiAgentEnabled = true` no banco de dados
2. Verificar se webhook foi configurado na Evolution API (`POST /webhook/set/{instanceName}`)
3. Verificar logs do workflow no n8n
4. Verificar se `N8N_AI_AGENT_WEBHOOK_URL` está correto no `.env`

### Erro ao criar agendamento
1. Verificar se o serviço existe e está ativo
2. Verificar se a agenda existe e está ativa
3. Verificar se o horário está disponível
4. Verificar logs do PostgreSQL

### Webhook não recebe mensagens
1. Verificar se a instância está conectada (`isConnected = true`)
2. Verificar se o webhook foi configurado corretamente na Evolution API
3. Testar enviar mensagem manualmente e verificar logs do n8n
