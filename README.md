# Calenvo App
![Status](https://img.shields.io/badge/status-active-success.svg) ![Next.js](https://img.shields.io/badge/Next.js-14.2-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue)

## 📋 Visão Geral
O **Calenvo App** é uma solução de agendamento e gerenciamento de disponibilidade de alta performance, projetada para facilitar a conexão entre prestadores de serviço e clientes. A aplicação resolve o problema complexo de gestão de turnos, configurações de dias personalizados e bloqueios de horário, oferecendo uma interface intuitiva e responsiva.

Construído sobre uma arquitetura moderna, o sistema prioriza a integridade dos dados e a experiência do usuário, utilizando renderização híbrida (SSR/CSR) para otimização de SEO e performance.

## 🏗 Arquitetura e Design
O projeto segue uma arquitetura baseada em componentes e serviços, utilizando o **Next.js App Router**:

*   **Frontend**: React com componentes funcionais e Hooks customizados (`hooks/`). A UI é construída com **Tailwind CSS** e **Shadcn/UI** para consistência visual.
*   **Backend**: API Routes do Next.js servindo como camada de backend, comunicando-se com o banco de dados via **Prisma ORM**.
*   **Gestão de Estado**: Utiliza `zustand` e `jotai` para gerenciamento de estado global leve e reativo, além de `React Query` para data fetching e caching.
*   **Autenticação**: Implementada via **NextAuth.js**, garantindo segurança e sessões persistentes com o adaptador Prisma.
*   **Design Patterns**:
    *   *Adapter Pattern*: Na integração com serviços de terceiros (AWS S3, Stripe).
    *   *Compound Components*: Em elementos de UI complexos.
    *   *Repository/Service*: Isolamento da lógica de banco de dados no diretório `lib/` e `prisma/`.

## ⚙️ Instalação

### Pré-requisitos
*   Node.js v20.x ou superior
*   Gerenciador de pacotes (`npm`, `yarn` ou `pnpm`)
*   PostgreSQL (instância local ou remota)

### Passo a Passo

1.  **Clone o repositório**
    ```bash
    git clone https://github.com/thiagow/calenvoapp.git
    cd calenvoapp
    ```

2.  **Instale as dependências**
    ```bash
    npm install
    # ou
    yarn install
    ```

3.  **Configure o Ambiente**
    Crie o arquivo `.env` na raiz:
    ```env
    DATABASE_URL="postgresql://user:password@localhost:5432/calenvo"
    NEXTAUTH_SECRET="sua_chave_secreta"
    # Adicione outras chaves conforme necessário (AWS, Stripe, etc.)
    ```

4.  **Sincronize o Banco de Dados**
    ```bash
    npx prisma generate
    npx prisma db push
    ```

## � Guia de Uso

### Desenvolvimento Local
Para iniciar o servidor de desenvolvimento com *hot-reload*:

```bash
npm run dev
```
Acesse: [http://localhost:3000](http://localhost:3000)

### Scripts de Verificação
O projeto inclui scripts utilitários para diagnóstico rápido:

**Verificar Agendamentos:**
```bash
node check_schedules.js
```

**Verificar Usuários:**
```bash
node check_users.js
```

### Build de Produção
Para compilar a aplicação para produção:

```bash
npm run build
npm start
```

## 📂 Estrutura de Diretórios

```plaintext
calenvoapp/
├── app/                  # Rotas, Páginas e APIs (Next.js App Router)
│   ├── api/              # Endpoints da API REST
│   └── ...               # Páginas da aplicação
├── components/           # Biblioteca de componentes UI reutilizáveis
│   ├── ui/               # Componentes base (Shadcn)
│   └── schedule/         # Componentes específicos de agendamento
├── contexts/             # Provedores de Contexto React (Estado Global)
├── hooks/                # Custom React Hooks
├── lib/                  # Utilitários, configurações e lógica de negócio
├── prisma/               # Schema do banco de dados e migrações
├── public/               # Assets estáticos (imagens, fontes)
└── scripts/              # Scripts de automação e manutenção
```

## 🤝 Contribuição e Testes

### Padrões de Código
O projeto utiliza ESLint e Prettier para manter a qualidade do código.

```bash
# Executar Linter
npm run lint
```

### Testes
Testes manuais podem ser executados com os scripts fornecidos na raiz. Implementação de testes automatizados (Jest/Cypress) está planejada para o roadmap futuro.
