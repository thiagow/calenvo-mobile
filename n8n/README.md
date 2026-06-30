# n8n Workflows e Integrações

Este diretório contém os fluxos do n8n (workflows), consultas SQL e códigos JavaScript utilizados na integração do Calenvo App com o WhatsApp (via Evolution API).

## Estrutura de Pastas

```
n8n/
├── README.md
├── workflows/             # Arquivos JSON exportados do n8n
│   ├── disparo-mensagens-calenvo.json
│   └── fluxo-disparo-calenvo.json
└── sql/                   # Queries e código para os nós
    ├── reminder-query.sql      # SELECT: busca agendamentos pendentes de lembrete
    ├── log-sucesso.sql         # INSERT: registra envio bem-sucedido
    ├── log-erro.sql            # INSERT: registra falha no envio
    └── montar-mensagem.js      # JS: substitui variáveis Mustache no template
```

## Workflow: Disparo de Lembretes WhatsApp

### Fluxo
1. **Schedule Trigger** → Executa 1x por dia (08:00)
2. **PostgreSQL** → Roda `reminder-query.sql` (busca multi-tenant)
3. **IF** → Verifica se há resultados
4. **Loop** → Itera item a item
5. **Wait 5s** → Delay anti-spam
6. **Code** → Monta mensagem com `montar-mensagem.js`
7. **Evolution API** → Envia via WhatsApp
8. **Log** → INSERT na tabela `Notification` (sucesso ou erro)

### Anti-duplicata
O `reminder-query.sql` verifica na tabela `Notification` se já existe um registro `APPOINTMENT_REMINDER` para cada agendamento, evitando reenvio.

## Como Atualizar
1. Faça as alterações no painel do n8n
2. Exporte o workflow como JSON
3. Substitua o arquivo correspondente em `/workflows`
4. Faça commit das alterações no Git
