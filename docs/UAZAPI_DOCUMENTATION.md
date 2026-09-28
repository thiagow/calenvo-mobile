# UAZAPI V2 - Documentação de Endpoints

**Base URL:** `https://free.uazapi.com` (ou seu domínio personalizado)

## Autenticação
Todos os endpoints requerem um token válido no header ou parâmetro.

---

## 1. POST /send/text - Enviar Mensagem de Texto

**Descrição:** Envia uma mensagem de texto para um contato, grupo ou canal/newsletter.

### Recursos Específicos
- **Preview de links:** com suporte a personalização automática ou customizada
- **Formatação básica** do texto
- **Substituição automática de placeholders** dinâmicos

### Campos Comuns Suportados
Todos os campos opcionais comuns documentados em "Enviar Mensagem":
- `delay` - Atraso em milissegundos antes do envio
- `readchat` - Marca conversa como lida após envio
- `readmessages` - Marca últimas mensagens recebidas como lidas
- `replyid` - ID da mensagem para responder
- `mentions` - Números para mencionar (separados por vírgula)
- `forward` - Marca a mensagem como encaminhada no WhatsApp
- `track_source` - Origem do rastreamento da mensagem
- `track_id` - ID para rastreamento da mensagem

### Request Body

| Campo | Tipo | Obrigatório | Descrição | Exemplo |
|-------|------|-------------|-----------|---------|
| `number` | string | Sim | ID do chat (telefone, @g.us, @s.whatsapp.net, @lid, @newsletter) | "5511999999999" |
| `text` | string | Sim | Texto da mensagem (aceita placeholders) | "Olá {{name}}! Como posso ajudar?" |
| `linkPreview` | boolean | Não | Ativa/desativa preview de links | true |
| `linkPreviewTitle` | string | Não | Título personalizado para preview | "Título Personalizado" |
| `linkPreviewDescription` | string | Não | Descrição personalizada para preview | "Descrição personalizada" |
| `linkPreviewImage` | string | Não | URL ou Base64 da imagem do preview | "https://exemplo.com/imagem.jpg" |
| `linkPreviewLarge` | boolean | Não | Se true, gera preview grande com upload da imagem | true |
| `replyid` | string | Não | ID da mensagem para responder | "3EB0538DA65A59F6D8A251" |
| `mentions` | string | Não | Números para mencionar (separados por vírgula) | "5511999999999,5511888888888" |
| `readchat` | boolean | Não | Marca conversa como lida após envio | true |
| `readmessages` | boolean | Não | Marca últimas mensagens como lidas | true |
| `delay` | integer | Não | Atraso em milissegundos | 1000 |
| `forward` | boolean | Não | Marca como encaminhada | true |
| `track_source` | string | Não | Origem do rastreamento | "chatwoot" |
| `track_id` | string | Não | ID para rastreamento | "msg_123456789" |
| `async` | boolean | Não | Envio assíncrono via fila interna | false |

### Respostas
- **200** - Mensagem enviada com sucesso
- **400** - Requisição inválida
- **401** - Não autorizado
- **429** - Limite de requisições excedido
- **500** - Erro interno do servidor

---

## 2. POST /send/media - Enviar Mídia

**Descrição:** Envia diferentes tipos de mídia para um contato, grupo ou canal/newsletter. Suporta URLs ou arquivos em base64.

### Tipos de Mídia Suportados
- `image` - Imagens (JPG preferencialmente)
- `video` - Vídeos (apenas MP4)
- `videoplay` - Vídeo com comportamento visual de autoplay/loop no WhatsApp
- `document` - Documentos (PDF, DOCX, XLSX, etc)
- `audio` - Áudio comum (MP3 ou OGG)
- `myaudio` - Mensagem de voz (alternativa ao PTT)
- `ptt` - Mensagem de voz (Push-to-Talk)
- `ptv` - Mensagem de vídeo (Push-to-Video)
- `sticker` - Figurinha/Sticker

### Recursos Específicos
- Upload por URL ou base64
- Caption/legenda opcional com suporte a placeholders
- Nome personalizado para documentos (`docName`)
- Geração automática de thumbnails
- Compressão otimizada conforme o tipo
- `viewOnce` recomendado para mídia compatível

### Request Body

| Campo | Tipo | Obrigatório | Descrição | Exemplo |
|-------|------|-------------|-----------|---------|
| `number` | string | Sim | ID do chat (telefone, @g.us, @s.whatsapp.net, @lid, @newsletter) | "5511999999999" |
| `type` | string | Sim | Tipo de mídia (image, video, videoplay, document, audio, myaudio, ptt, ptv, sticker) | "image" |
| `file` | string | Sim | URL ou base64 do arquivo | "https://exemplo.com/imagem.jpg" |
| `text` | string | Não | Texto descritivo (caption) - aceita placeholders | "Veja esta foto!" |
| `docName` | string | Não | Nome do arquivo (apenas para documents) | "relatorio.pdf" |
| `thumbnail` | string | Não | URL ou base64 de thumbnail para vídeos e documentos | "https://exemplo.com/thumb.jpg" |
| `mimetype` | string | Não | MIME type do arquivo (detectado automaticamente) | "application/pdf" |
| `viewOnce` | boolean | Não | Visualização única para tipos compatíveis | true |
| `replyid` | string | Não | ID da mensagem para responder | "3EB0538DA65A59F6D8A251" |
| `mentions` | string | Não | Números para mencionar | "5511999999999,5511888888888" |
| `readchat` | boolean | Não | Marca conversa como lida | true |
| `readmessages` | boolean | Não | Marca mensagens como lidas | true |
| `delay` | integer | Não | Atraso em milissegundos | 1000 |
| `forward` | boolean | Não | Marca como encaminhada | true |
| `track_source` | string | Não | Origem do rastreamento | "chatwoot" |
| `track_id` | string | Não | ID para rastreamento | "msg_123456789" |
| `async` | boolean | Não | Envio assíncrono | false |

### Respostas
- **200** - Mídia enviada com sucesso
- **400** - Requisição inválida
- **401** - Não autorizado
- **413** - Arquivo muito grande
- **415** - Formato de mídia não suportado
- **500** - Erro interno do servidor

---

## 3. POST /send/contact - Enviar Cartão de Contato (vCard)

**Descrição:** Envia um cartão de contato (vCard) para um contato ou grupo.

### Recursos Específicos
- vCard completo com nome, telefones, organização, email e URL
- Múltiplos números de telefone (separados por vírgula)
- Cartão clicável no WhatsApp para salvar na agenda
- Informações profissionais (organização/empresa)

### Request Body

| Campo | Tipo | Obrigatório | Descrição | Exemplo |
|-------|------|-------------|-----------|---------|
| `number` | string | Sim | ID do chat (telefone, @g.us, @s.whatsapp.net, @lid) | "5511999999999" |
| `fullName` | string | Sim | Nome completo do contato | "João Silva" |
| `phoneNumber` | string | Sim | Números de telefone (separados por vírgula) | "5511999999999,5511888888888" |
| `organization` | string | Não | Nome da organização/empresa | "Empresa XYZ" |
| `email` | string | Não | Endereço de email | "joao@empresa.com" |
| `url` | string | Não | URL pessoal ou da empresa | "https://empresa.com/joao" |
| `replyid` | string | Não | ID da mensagem para responder | "3EB0538DA65A59F6D8A251" |
| `mentions` | string | Não | Números para mencionar | "5511999999999,5511888888888" |
| `readchat` | boolean | Não | Marca conversa como lida | true |
| `readmessages` | boolean | Não | Marca mensagens como lidas | true |
| `delay` | integer | Não | Atraso em milissegundos | 1000 |
| `forward` | boolean | Não | Marca como encaminhada | true |
| `track_source` | string | Não | Origem do rastreamento | "chatwoot" |
| `track_id` | string | Não | ID para rastreamento | "msg_123456789" |
| `async` | boolean | Não | Envio assíncrono | false |

### Respostas
- **200** - Cartão de contato enviado com sucesso
- **400** - Requisição inválida
- **401** - Não autorizado
- **429** - Limite de requisições excedido
- **500** - Erro interno do servidor

---

## 4. POST /send/location - Enviar Localização Geográfica

**Descrição:** Envia uma localização geográfica para um contato ou grupo.

### Recursos Específicos
- Coordenadas precisas (latitude e longitude obrigatórias)
- Nome do local para identificação
- Endereço completo para exibição detalhada
- Mapa interativo no WhatsApp para navegação
- Pin personalizado com nome do local

### Request Body

| Campo | Tipo | Obrigatório | Descrição | Exemplo |
|-------|------|-------------|-----------|---------|
| `number` | string | Sim | ID do chat (telefone, @g.us, @s.whatsapp.net, @lid) | "5511999999999" |
| `name` | string | Não | Nome do local | "MASP" |
| `address` | string | Não | Endereço do local | "Av. Paulista, 1578 - Bela Vista, São Paulo - SP" |
| `latitude` | number | Sim | Latitude (-90 a 90) | -23.5616 |
| `longitude` | number | Sim | Longitude (-180 a 180) | -46.6562 |
| `replyid` | string | Não | ID da mensagem para responder | "3EB0538DA65A59F6D8A251" |
| `mentions` | string | Não | Números para mencionar | "5511999999999,5511888888888" |
| `readchat` | boolean | Não | Marca conversa como lida | true |
| `readmessages` | boolean | Não | Marca mensagens como lidas | true |
| `delay` | integer | Não | Atraso em milissegundos | 1000 |
| `forward` | boolean | Não | Marca como encaminhada | true |
| `track_source` | string | Não | Origem do rastreamento | "chatwoot" |
| `track_id` | string | Não | ID para rastreamento | "msg_123456789" |
| `async` | boolean | Não | Envio assíncrono | false |

### Respostas
- **200** - Localização enviada com sucesso
- **400** - Requisição inválida
- **401** - Não autorizado
- **429** - Limite de requisições excedido
- **500** - Erro interno do servidor

---

## 5. POST /send/menu - Enviar Menu Interativo

**Descrição:** Endpoint unificado para envio de quatro tipos principais de mensagens interativas:
- Botões: Para ações rápidas e diretas
- Listas: Para menus organizados em seções
- Enquetes: Para coleta de opiniões e votações
- Carrossel: Para lista horizontal de botões com imagens

### Estrutura Base do Payload

```json
{
  "number": "5511999999999",
  "type": "button|list|poll|carousel",
  "text": "Texto principal da mensagem",
  "choices": ["opções baseadas no tipo escolhido"],
  "footerText": "Texto do rodapé (opcional)",
  "listButton": "Texto do botão (para listas)",
  "selectableCount": "Número de opções selecionáveis (enquetes)"
}
```

### Tipos de Mensagens Interativas

#### 1.1 Botões (type: "button")
Cria botões interativos com diferentes funcionalidades.

**Formatos de Botões:**
- **Botão de Resposta:** `"texto|id"` ou `"texto\nid"` (ID igual ao texto se omitido)
- **Botão de Cópia:** `"texto|copy:código"` ou `"texto\ncopy:código"`
- **Botão de Chamada:** `"texto|call:+5511999999999"` ou `"texto\ncall:+5511999999999"`
- **Botão de URL:** `"texto|https://exemplo.com"` ou `"texto|url:https://exemplo.com"`

**Botões com Imagem:** Use `imageButton` para adicionar imagem aos botões

#### 1.2 Listas (type: "list")
Menus organizados em seções com itens selecionáveis.

**Formato das Choices:**
- `"[Título da Seção]"` - Inicia uma nova seção
- `"texto|id|descrição"` - Item da lista (id e descrição opcionais)

#### 1.3 Enquetes (type: "poll")
Enquetes interativas para votação.

**Campos Específicos:**
- `selectableCount` - Número de opções que podem ser selecionadas (padrão: 1)
- `choices` - Array simples com as opções de voto

#### 1.4 Carousel (type: "carousel")
Carrossel de cartões com imagens e botões interativos.

**Formato das Choices:**
```
[Texto do cartão]
{URL ou base64 da imagem}
"texto|copy:código"
"texto|https://url"
"texto|call:+número"
```

### Request Body

| Campo | Tipo | Obrigatório | Descrição | Exemplo |
|-------|------|-------------|-----------|---------|
| `number` | string | Sim | ID do chat | "5511999999999" |
| `type` | string | Sim | Tipo do menu (button, list, poll, carousel) | "list" |
| `text` | string | Sim | Texto principal (aceita placeholders) | "Escolha uma opção:" |
| `footerText` | string | Não | Texto do rodapé (opcional) | "Menu de serviços" |
| `listButton` | string | Não | Texto do botão principal (para listas) | "Ver opções" |
| `selectableCount` | integer | Não | Números máximo de opções selecionáveis (enquetes) | 1 |
| `choices` | array | Sim | Lista de opções. Use [Título] para seções em listas | [...] |
| `imageButton` | string | Não | URL da imagem para botões | "https://exemplo.com/imagem-botao.jpg" |
| `replyid` | string | Não | ID da mensagem para responder | "3EB0538DA65A59F6D8A251" |
| `mentions` | string | Não | Números para mencionar | "5511999999999,5511888888888" |
| `readchat` | boolean | Não | Marca conversa como lida | true |
| `readmessages` | boolean | Não | Marca mensagens como lidas | true |
| `delay` | integer | Não | Atraso em milissegundos | 1000 |
| `track_source` | string | Não | Origem do rastreamento | "chatwoot" |
| `track_id` | string | Não | ID para rastreamento | "msg_123456789" |
| `async` | boolean | Não | Envio assíncrono | false |

### Respostas
- **200** - Menu enviado com sucesso
- **400** - Requisição inválida
- **401** - Não autorizado
- **429** - Limite de requisições excedido
- **500** - Erro interno do servidor

---

## 6. POST /send/carousel - Enviar Carrossel de Mídia com Botões

**Descrição:** Permite enviar um carrossel com imagens e botões interativos. Funciona de maneira similar a `/send/menu`.

### Estrutura do Payload

```json
{
  "number": "5511999999999",
  "text": "Texto principal",
  "carousel": [
    {
      "text": "Texto do cartão",
      "image": "URL da imagem",
      "buttons": [
        {
          "id": "resposta1",
          "text": "Texto do botão",
          "type": "REPLY"
        }
      ]
    }
  ],
  "delay": 1000,
  "readchat": true
}
```

### Tipos de Botões

| Tipo | Descrição | Campo `id` |
|------|-----------|-----------|
| `REPLY` | Botão de resposta rápida | Valor enviado como resposta |
| `URL` | Botão com link | URL completa (ex: https://exemplo.com) |
| `COPY` | Botão para copiar texto | Texto a ser copiado |
| `CALL` | Botão para realizar chamada | Número de telefone |

### Request Body

| Campo | Tipo | Obrigatório | Descrição | Exemplo |
|-------|------|-------------|-----------|---------|
| `number` | string | Sim | ID do chat | "5511999999999" |
| `text` | string | Sim | Texto principal da mensagem | "Nossos Produtos em Destaque" |
| `carousel` | array | Sim | Array de cartões do carrossel | [...] |
| `delay` | integer | Não | Atraso em milissegundos | 1000 |
| `readchat` | boolean | Não | Marca conversa como lida | true |
| `readmessages` | boolean | Não | Marca mensagens como lidas | true |
| `replyid` | string | Não | ID da mensagem para responder | "3EB0538DA65A59F6D8A251" |
| `mentions` | string | Não | Números para mencionar | "5511999999999,5511888888888" |
| `forward` | boolean | Não | Marca como encaminhada | false |
| `track_source` | string | Não | Origem do rastreamento | "chatwoot" |
| `track_id` | string | Não | ID para rastreamento | "msg_123456789" |
| `async` | boolean | Não | Envio assíncrono | false |

### Respostas
- **200** - Carrossel enviado com sucesso
- **400** - Requisição inválida
- **401** - Não autorizado
- **500** - Erro interno do servidor

---

## Campos Comuns a Todos os Endpoints

### Placeholders
Todos os campos `text` e `caption` suportam placeholders dinâmicos que serão substituídos automaticamente:
- `{{name}}` - Nome do contato
- `{{phone}}` - Número de telefone
- E outros conforme configurado na conta

### Formatos de Number
- **Contato individual:** `"5511999999999"` (formato internacional)
- **Grupo:** `"123456789-1234567890@g.us"`
- **Comunidade:** `"123456789-1234567890@s.whatsapp.net"`
- **Newsletter/Canal:** `"120363123456789012@newsletter"`
- **Broadcast List:** `"123456789@lid"`

### Delay e Digitação
Quando `delay` é usado, o WhatsApp exibirá:
- "Digitando..." para mensagens de texto
- "Gravando áudio..." para áudios e vídeos de voz
- O atraso é em milissegundos (ex: 1000 = 1 segundo)

---

## Notas Importantes

1. **Limite de Requisições:** API implementa rate limiting (429 Too Many Requests)
2. **Async:** Use `async: true` para alto volume de mensagens
3. **Rastreamento:** Combine `track_source` e `track_id` para rastrear mensagens
4. **Compatibilidade:** Recursos de botões interativos podem ser descontinuados. Prepare fluxos flexíveis.
5. **Autenticação:** Token deve ser incluído em todas as requisições
6. **Suporte a Emoji:** Todos os campos de texto suportam emojis

---

**Última atualização:** 31 de julho de 2026
**Base URL:** https://docs.uazapi.com
