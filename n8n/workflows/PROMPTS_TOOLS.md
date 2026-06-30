# Prompts de Descrição das Ferramentas (Tools)

Copie e cole estes textos no campo **"Description"** de cada Tool no n8n.
Isso ajuda a IA a entender *quando* e *como* usar cada ferramenta.

---

## 🛠️ Tool 1: Consultar Serviços
**Nome:** `consultar_servicos`

**Descrição (Description):**
```text
Lista os serviços oferecidos pela empresa, incluindo nome, duração e preço.
Use esta ferramenta quando o cliente perguntar sobre "quais serviços tem", "quanto custa" ou "preços".
Não requer parâmetros de entrada da IA.
```

---

## 🛠️ Tool 2: Consultar Disponibilidade
**Nome:** `consultar_disponibilidade`

**Descrição (Description):**
```text
Verifica os horários disponíveis (slots) para um serviço em uma data específica.
Use esta ferramenta quando o cliente indicar uma data ou disser "tem horário para dia X?".
Se a data estiver cheia, retornará opções para os dias seguintes.

Requer os parâmetros:
- serviceId: O ID do serviço que o cliente quer (obtido via consultar_servicos).
- date: A data desejada no formato YYYY-MM-DD (ex: 2024-02-25).
- scheduleId: (Opcional) O ID da agenda/profissional específico, se o cliente pedir alguém pelo nome.
```

---

## 🛠️ Tool 3: Info Empresa
**Nome:** `info_empresa`

**Descrição (Description):**
```text
Busca informações gerais da empresa como endereço, telefone, WhatsApp e horário de funcionamento.
Use para responder dúvidas institucionais ou quando o cliente pedir a localização.
Não requer parâmetros de entrada da IA.
```

---

## 🛠️ Tool 4: Criar Agendamento
**Nome:** `criar_agendamento`

**Descrição (Description):**
```text
Finaliza e confirma o agendamento no sistema.
Use esta ferramenta APENAS quando o cliente já escolheu o serviço, a data e o horário, e confirmou que quer agendar.
Nunca use esta ferramenta para "verificar" se dá para agendar; use a consultar_disponibilidade para isso.

Requer os parâmetros:
- clientName: Nome completo do cliente.
- clientPhone: Telefone do cliente (apenas números, com DDD).
- serviceId: ID do serviço escolhido.
- scheduleId: ID da agenda/profissional.
- date: Data e hora de INÍCIO do agendamento no formato ISO 8601 (ex: 2024-02-20T14:30:00).
```
