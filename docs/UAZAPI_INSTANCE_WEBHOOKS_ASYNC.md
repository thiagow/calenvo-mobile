# UAZAPI V2 - Documentação de Instância, Webhooks e Async

**Base URL:** `https://free.uazapi.com` (ou seu domínio personalizado)

---

## 1. POST /instance/connect - Conectar Instância ao WhatsApp

**Descrição:** Inicia o processo de conexão de uma instância ao WhatsApp. Requer o token de autenticação da instância e gera um QR code ou código de pareamento.

### Processo de Conexão

- Requer o token de autenticação da instância
- Recebe o número de telefone associado à conta WhatsApp
- Gera um QR code caso não passe o campo `phone`
- Ou gera código de pareamento se passar o campo `phone`
- Atualiza o status da instância para "connecting"

### Sincronização e Armazenamento

- Todas as mensagens recebidas da Meta durante a sincronização são enviadas via webhook
- As mensagens dos últimos 7 dias são armazenadas no banco de dados
- Mensagens mais antigas do que 7 dias são excluídas durante a madrugada

### Proxy Regional

- Suporte para proxy regional (Brasil atualmente)
- Use `GET /proxy-managed/cities?country=br` para listar cidades
- Campos: `proxy_managed_country`, `proxy_managed_state`, `proxy_managed_city`

### Estados Possíveis da Instância

- `disconnected` - Desconectado do WhatsApp
- `connecting` - Em processo de conexão
- `connected` - Conectado e autenticado
- `hibernated` - Sessão pausada, com credenciais preservadas

### Request Body

| Campo | Tipo | Obrigatório | Descrição | Exemplo |
|-------|------|-------------|-----------|---------|
| `phone` | string | Não | Número de telefone no formato internacional | "5511999999999" |
| `browser` | string | Não | Browser usado (auto, safari, firefox, edge, chrome) | "auto" |
| `systemName` | string | Não | Sistema/nome exibido no celular | "Minha Empresa" |
| `proxy_managed_country` | string | Não | País para proxy regional (ISO alpha-2 minúsculo) | "br" |
| `proxy_managed_state` | string | Não | Estado/subdivisão da cidade | "sp" |
| `proxy_managed_city` | string | Não | Cidade para proxy regional | "campinas" |

### Respostas

- **200** - Sucesso
- **401** - Token inválido/expirado
- **404** - Instância não encontrada
- **429** - Limite de conexões simultâneas atingido
- **500** - Erro interno
- **503** - Capacidade de conexão temporariamente indisponível

---

## 2. POST /instance/disconnect - Desconectar Instância

**Descrição:** Desconecta a conta do WhatsApp atualmente conectada, encerrando a sessão atual.

### Operação

Encerra completamente a sessão, exigindo novo login na próxima conexão.

### Diferenças

- **Desconectar:** Encerra completamente a sessão
- **Hibernar:** Mantém a sessão ativa, apenas pausa a conexão

### Estados Possíveis Após Desconectar

- `disconnected` - Desconectado do WhatsApp
- `connecting` - Em processo de reconexão (após usar /instance/connect)

### Respostas

- **200** - Sucesso
- **401** - Token inválido/expirado
- **404** - Instância não encontrada
- **500** - Erro interno

---

## 3. GET /instance/status - Verificar Status da Instância

**Descrição:** Retorna o status atual de uma instância, incluindo estado da conexão, QR code atualizado e informações de desconexão.

### Retorna

- Estado da conexão (disconnected, connecting, connected, hibernated)
- QR code atualizado (se em processo de conexão)
- Código de pareamento (se disponível)
- Informações da última desconexão
- Detalhes completos da instância

### Casos de Uso

- Monitorar o progresso da conexão
- Obter QR codes atualizados durante o processo
- Verificar o estado atual da instância
- Identificar problemas de conexão

### Estados Possíveis

- `disconnected` - Desconectado do WhatsApp
- `connecting` - Em processo de conexão (aguardando QR code ou código de pareamento)
- `connected` - Conectado e autenticado com sucesso
- `hibernated` - Sessão pausada, com credenciais preservadas

### Respostas

- **200** - Sucesso
- **401** - Token inválido/expirado
- **404** - Instância não encontrada
- **500** - Erro interno

---

## 4. DELETE /instance - Deletar Instância

**Descrição:** Remove a instância do sistema permanentemente.

### Respostas

- **200** - Instância deletada com sucesso
- **401** - Falha na autenticação
- **404** - Instância não encontrada
- **500** - Erro interno do servidor

---

## 5. GET /webhook - Ver Webhook da Instância

**Descrição:** Retorna a configuração atual do webhook da instância.

### Retorna

- URL configurada
- Eventos ativos
- Filtros aplicados
- Configurações adicionais

### Exemplo de Resposta

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "enabled": true,
  "url": "https://example.com/webhook",
  "events": ["messages", "messages_update"],
  "excludeMessages": ["wasSentByApi"],
  "isGroupNo": true,
  "addUrlEvents": true,
  "addUrlTypesMessages": true
}
```

**Nota:** A resposta é sempre um array, mesmo quando há apenas um webhook configurado.

### Respostas

- **200** - Configuração do webhook retornada com sucesso
- **401** - Token inválido ou não fornecido
- **500** - Erro interno do servidor

---

## 6. POST /webhook - Configurar Webhook da Instância

**Descrição:** Gerencia a configuração de webhooks para receber eventos em tempo real.

### 🚀 Modo Simples (Recomendado)

Uso mais fácil - sem complexidade de IDs

- Não inclua `action` no payload
- Gerencia automaticamente um único webhook por instância
- Cria novo ou atualiza o existente automaticamente
- **Recomendado:** Use `"excludeMessages": ["wasSentByApi"]` para evitar loops

Exemplo:
```json
{
  "url": "https://meusite.com/webhook",
  "events": ["messages"],
  "excludeMessages": ["wasSentByApi"]
}
```

### 🧪 Sites para Testes

1. https://webhook.cool/ - ⭐ Melhor opção (sem rate limit)
2. https://rbaskets.in/ - ⭐ Boa alternativa (confiável)
3. https://webhook.site/ - ⚠️ Evitar se possível (rate limit agressivo)

### ⚙️ Modo Avançado (Para múltiplos webhooks)

Usar `action` para gerenciar múltiplos webhooks.

**Criar Novo Webhook:**
- Use `action: "add"`
- O sistema gera ID automaticamente

**Atualizar Webhook Existente:**
- Use `action: "update"`
- Inclua o `id` do webhook

**Remover Webhook:**
- Use `action: "delete"`
- Inclua apenas o `id`

### Eventos Disponíveis

- `connection` - Alterações no estado da conexão
- `history` - Recebimento de histórico de mensagens
- `messages` - Novas mensagens recebidas
- `messages_update` - Atualizações em mensagens existentes
- `newsletter_messages` - Novos posts de canais do WhatsApp
- `call` - Eventos de chamadas VoIP
- `contacts` - Atualizações na agenda de contatos
- `presence` - Alterações no status de presença
- `groups` - Modificações em grupos
- `labels` - Gerenciamento de etiquetas
- `chats` - Eventos de conversas
- `chat_labels` - Alterações em etiquetas de conversas
- `blocks` - Bloqueios/desbloqueios
- `sender` - Atualizações de campanhas

### Filtros de Mensagens

- `wasSentByApi` - Mensagens originadas pela API (**IMPORTANTE:** Use para evitar loops)
- `wasNotSentByApi` - Mensagens não originadas pela API
- `fromMeYes` - Mensagens enviadas pelo usuário
- `fromMeNo` - Mensagens recebidas de terceiros
- `isGroupYes` - Mensagens em grupos
- `isGroupNo` - Mensagens em conversas individuais

### Parâmetros de URL

- `addUrlEvents` (boolean) - Adiciona o tipo do evento como path parameter
  - Exemplo: `https://api.example.com/webhook/{evento}`

- `addUrlTypesMessages` (boolean) - Adiciona o tipo da mensagem como path parameter
  - Exemplo: `https://api.example.com/webhook/{tipo_mensagem}`

### Request Body

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | string | Não | ID único do webhook (necessário para update/delete) |
| `enabled` | boolean | Não | Habilita/desabilita o webhook |
| `url` | string | Sim | URL para receber os eventos |
| `events` | array | Não | Lista de eventos monitorados |
| `excludeMessages` | array | Não | Filtros para excluir tipos de mensagens |
| `addUrlEvents` | boolean | Não | Adiciona tipo do evento como parâmetro na URL |
| `addUrlTypesMessages` | boolean | Não | Adiciona tipo da mensagem como parâmetro na URL |
| `action` | string | Não | Ação (add, update, delete) - omitir para modo simples |

### Respostas

- **200** - Webhook configurado ou atualizado com sucesso
- **400** - Requisição inválida
- **401** - Token inválido ou não fornecido
- **500** - Erro interno do servidor

---

## 7. GET /webhook/errors - Ver Últimos Erros do Webhook

**Descrição:** Retorna em memória os últimos 20 erros de envio dos webhooks locais.

### Informações Retornadas

Cada item inclui:
- Data/hora (`created`)
- URL de destino
- Evento
- Tipo do webhook (`local`)
- Payload tentado
- Número de tentativas

### Observações

- O histórico fica apenas em memória e é perdido quando o processo reinicia
- O endpoint usa o mesmo token da instância
- Retorna apenas falhas dos webhooks locais da própria instância
- Falhas do webhook global ficam disponíveis em `/globalwebhook/errors` com `admintoken`
- O header `X-Webhook-Error-Capture-Started-At` informa desde quando a captura está valendo

### Respostas

- **200** - Histórico retornado com sucesso
- **401** - Token inválido ou não fornecido

---

## 8. GET /sse - Server-Sent Events (SSE)

**Descrição:** Estabelece uma conexão persistente para receber eventos em tempo real via Server-Sent Events.

### Funcionalidades Principais

- Configuração de URL para recebimento de eventos
- Seleção granular de tipos de eventos
- Filtragem avançada de mensagens
- Parâmetros adicionais na URL
- Gerenciamento múltiplo de eventos

### Eventos Disponíveis

- `connection` - Alterações no estado da conexão
- `history` - Recebimento de histórico de mensagens
- `messages` - Novas mensagens recebidas
- `messages_update` - Atualizações em mensagens existentes
- `call` - Eventos de chamadas VoIP
- `contacts` - Atualizações na agenda de contatos
- `presence` - Alterações no status de presença
- `groups` - Modificações em grupos
- `labels` - Gerenciamento de etiquetas
- `chats` - Eventos de conversas
- `chat_labels` - Alterações em etiquetas de conversas
- `blocks` - Bloqueios/desbloqueios

### Como Funciona

- Requer autenticação via token
- Mantém uma conexão HTTP aberta com o cliente
- Envia eventos conforme ocorrem no servidor
- Suporta diferentes tipos de eventos

### Exemplo de Uso (JavaScript)

```javascript
const eventSource = new EventSource('/sse?token=SEU_TOKEN&events=chats,messages');

eventSource.onmessage = function(event) {
  const data = JSON.parse(event.data);
  console.log('Novo evento:', data);
};

eventSource.onerror = function(error) {
  console.error('Erro na conexão SSE:', error);
};
```

### Estrutura de um Evento

```json
{
  "type": "message",
  "data": {
    "id": "3EB0538DA65A59F6D8A251",
    "from": "5511999999999@s.whatsapp.net",
    "to": "5511888888888@s.whatsapp.net",
    "text": "Olá!",
    "timestamp": 1672531200000
  }
}
```

### Query Parameters

| Campo | Tipo | Obrigatório | Descrição | Exemplo |
|-------|------|-------------|-----------|---------|
| `token` | string | Sim | Token de autenticação da instância | "seu_token" |
| `events` | string | Sim | Tipos de eventos (separados por vírgula ou repetidos) | "chats,messages" |
| `excludeMessages` | string | Não | Tipos de mensagens a excluir (para evento `messages`) | "poll,reaction" |

---

## 9. GET /message/async - Consultar Fila Async de Envio

**Descrição:** Retorna um resumo da fila de envio assíncrono da instância atual.

### Cobertura

Cobre apenas a fila interna de envio direto assíncrono. **NÃO** inclui:
- Campanhas de envio em massa do sender (`/sender/*`)

### Resposta Padrão

| Campo | Descrição |
|-------|-----------|
| `status` | Visão resumida da fila (idle, queued, processing, waiting_connection, resetting) |
| `pending` | Quantidade total estimada de mensagens pendentes |
| `processingNow` | Indica se o worker está ocupando um job neste momento |
| `acceptingNewMessages` | Indica se a fila aceita novos envios async |
| `sessionReady` | Indica se a sessão WhatsApp está pronta para envio |
| `resetting` | Indica se a fila está pausada por reset/clear |

### Respostas

- **200** - Resumo da fila async
- **401** - Token inválido ou ausente
- **500** - Erro interno ao consultar a fila async

---

## 10. DELETE /message/async - Limpar Fila Async de Envio

**Descrição:** Cancela toda a fila de envio da instância e marca as mensagens pendentes como "Canceled".

### Cobertura

Atua apenas na fila interna de envio direto assíncrono. **NÃO** afeta:
- Campanhas do sender (`/sender/*`)
- Mensagens já enviadas com sucesso
- Mensagens em massa agendadas

### Fluxo Executado

1. Pausa o worker interno da fila async
2. Drena jobs pendentes em memória e overflow
3. Marca backlog persistido como "Canceled"
4. Libera a fila para novos envios async

### Casos de Uso

- Quando houver backlog preso
- Fila acumulada ou travada
- Quando você quiser abortar todos os envios pendentes

### Respostas

- **200** - Fila async limpa com sucesso
- **401** - Token inválido ou ausente
- **409** - A fila não pôde ser limpa (instância em reset ou envio em progresso)
- **500** - Erro interno ao limpar a fila async

---

## Resumo de Endpoints por Categoria

### Gerenciamento de Instância
- `POST /instance/connect` - Conectar
- `POST /instance/disconnect` - Desconectar
- `GET /instance/status` - Verificar status
- `DELETE /instance` - Deletar instância

### Webhooks e Eventos em Tempo Real
- `GET /webhook` - Ver configuração
- `POST /webhook` - Configurar webhook
- `GET /webhook/errors` - Ver erros
- `GET /sse` - Server-Sent Events

### Fila Assíncrona
- `GET /message/async` - Consultar fila
- `DELETE /message/async` - Limpar fila

---

## Boas Práticas

1. **Webhooks:** Sempre use `"excludeMessages": ["wasSentByApi"]` para evitar loops em automações
2. **Proxy Regional:** Configure o proxy adequado para melhor performance em sua região
3. **Async:** Monitore a fila com `GET /message/async` antes de fazer limpeza
4. **SSE:** Use para conexões de longa duração (streaming de eventos)
5. **Erros:** Verifique `/webhook/errors` para debugar falhas de webhook

---

**Última atualização:** 31 de julho de 2026
**Base URL:** https://docs.uazapi.com
