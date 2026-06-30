# Nós para adicionar ao workflow "Evolution QR Code"

## Endpoint: habilitar-webhook

Este endpoint recebe chamadas do Calenvo para habilitar/desabilitar o webhook da instância Evolution para receber mensagens do agente de IA.

### Nós a adicionar:

#### 1. Webhook Trigger: "habilitar-webhook"
```json
{
  "parameters": {
    "httpMethod": "POST",
    "path": "habilitar-webhook",
    "responseMode": "responseNode",
    "options": {}
  },
  "type": "n8n-nodes-base.webhook",
  "typeVersion": 2,
  "position": [1088, 800],
  "name": "habilitar-webhook",
  "webhookId": "<GERAR_NOVO_ID>"
}
```

#### 2. HTTP Request: "set-webhook-evo"
```json
{
  "parameters": {
    "method": "POST",
    "url": "=https://evolution-evolution-api.feidcm.easypanel.host/webhook/set/{{ $json.body.instanceName }}",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "apikey",
          "value": "Wh4Hgf19Kb1YEp41eQB8j8gLLqMiSMgX"
        }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={\n  \"enabled\": {{ $json.body.enabled }},\n  \"url\": \"{{ $json.body.webhookUrl }}\",\n  \"webhook_by_events\": false,\n  \"events\": [\"MESSAGES_UPSERT\"]\n}",
    "options": {}
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "position": [1392, 800],
  "name": "set-webhook-evo",
  "alwaysOutputData": false,
  "onError": "continueRegularOutput"
}
```

#### 3. Respond to Webhook: "respond-webhook-toggle"
```json
{
  "parameters": {
    "respondWith": "allIncomingItems",
    "options": {}
  },
  "type": "n8n-nodes-base.respondToWebhook",
  "typeVersion": 1.2,
  "position": [1696, 800],
  "name": "respond-webhook-toggle"
}
```

### Conexões:
- `habilitar-webhook` → `set-webhook-evo` (main)
- `set-webhook-evo` → `respond-webhook-toggle` (main)

### Payload esperado do Calenvo:
```json
{
  "instanceName": "clxy123-calenvo",
  "enabled": true,
  "webhookUrl": "https://n8n.seudominio.com/webhook/agente-ia-calenvo"
}
```

### Resposta:
```json
{
  "success": true
}
```
ou
```json
{
  "success": false,
  "error": "Mensagem de erro"
}
```

## Como adicionar ao workflow:

1. Abrir o workflow "Evolution QR Code" no n8n
2. Adicionar os 3 nós acima manualmente via interface
3. Conectar conforme especificado
4. Salvar e ativar o workflow
5. Copiar a URL do webhook gerada e adicionar ao `.env` como `N8N_WEBHOOK_TOGGLE_URL`
