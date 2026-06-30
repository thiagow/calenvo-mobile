# Autenticação - Sistema de Login e Cadastro

## 📋 Descrição

Sistema completo de autenticação com NextAuth.js, incluindo cadastro, login, recuperação de senha e gerenciamento de sessões.

## 📍 Localização no Código

### Páginas
- **Login**: `/login` → `app/login/page.tsx`
- **Cadastro**: `/signup` → `app/signup/page.tsx`
- **Cadastro Standard**: `/signup/standard` → `app/signup/standard/page.tsx`
- **Sucesso**: `/signup/success` → `app/signup/success/page.tsx`

### Componentes
- `components/auth/` - Componentes de autenticação

### APIs
- `POST /api/auth/signin` - Login (NextAuth)
- `POST /api/auth/signout` - Logout (NextAuth)
- `POST /api/signup` - Criar nova conta
- `POST /api/auth/forgot-password` - Recuperar senha
- `POST /api/auth/reset-password` - Resetar senha

### Configuração
- `lib/auth.ts` - Configuração NextAuth
- `middleware.ts` - Proteção de rotas

## 🎯 Funcionalidades

### Cadastro (Sign Up)

#### Fluxo Freemium (Gratuito)
```typescript
interface SignUpData {
  name: string
  email: string
  password: string
  businessName?: string
  segmentType: SegmentType
  phone?: string
}
```

**Fluxo**:
1. Usuário acessa `/signup`
2. Preenche formulário
3. Sistema valida dados
4. Cria usuário com planType: FREEMIUM
5. Cria BusinessConfig padrão
6. Cria PlanUsage inicial
7. Faz login automático
8. Redireciona para dashboard

#### Fluxo Standard/Premium (Pago)
1. Usuário acessa `/signup/standard`
2. Preenche dados pessoais
3. Escolhe plano (Standard ou Premium)
4. Redirecionado para checkout Stripe
5. Preenche dados de pagamento
6. Webhook confirma pagamento
7. Conta ativada com plano escolhido
8. Email de boas-vindas enviado

### Login

#### Credentials Provider
```typescript
// NextAuth configuration
providers: [
  CredentialsProvider({
    async authorize(credentials) {
      const user = await prisma.user.findUnique({
        where: { 
          email_role: {
            email: credentials.email,
            role: 'MASTER' // ou PROFESSIONAL
          }
        },
      })
      
      if (!user) return null
      
      const isValid = await bcrypt.compare(
        credentials.password, 
        user.password
      )
      
      if (!isValid) return null
      
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      }
    },
  }),
]
```

**Fluxo**:
1. Usuário acessa `/login`
2. Insere email e senha
3. NextAuth valida credenciais
4. Cria sessão (JWT + Database)
5. Redireciona para `/dashboard`

### Proteção de Rotas

#### Middleware
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const token = await getToken({ req: request })
  
  // Rotas protegidas
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }
  
  // Rotas públicas (já autenticado)
  if (['/login', '/signup'].includes(request.nextUrl.pathname)) {
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }
  
  return NextResponse.next()
}
```

### Sessão

#### Server Components
```typescript
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }
  
  return <Dashboard user={session.user} />
}
```

#### Client Components
```typescript
'use client'

import { useSession } from 'next-auth/react'

export function UserProfile() {
  const { data: session, status } = useSession()
  
  if (status === 'loading') return <Skeleton />
  if (status === 'unauthenticated') redirect('/login')
  
  return <ProfileCard user={session.user} />
}
```

### Logout
```typescript
import { signOut } from 'next-auth/react'

function LogoutButton() {
  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' })
  }
  
  return <Button onClick={handleLogout}>Sair</Button>
}
```

## 🔐 Segurança

### Hash de Senhas
```typescript
import bcrypt from 'bcryptjs'

// Ao criar usuário
const hashedPassword = await bcrypt.hash(password, 10)

await prisma.user.create({
  data: {
    email,
    password: hashedPassword,
    // ...
  },
})
```

### JWT e Sessions
```typescript
// NextAuth configuration
session: {
  strategy: 'jwt',
  maxAge: 30 * 24 * 60 * 60, // 30 dias
},

jwt: {
  maxAge: 30 * 24 * 60 * 60,
},

callbacks: {
  async jwt({ token, user }) {
    if (user) {
      token.id = user.id
      token.role = user.role
    }
    return token
  },
  
  async session({ session, token }) {
    if (session.user) {
      session.user.id = token.id
      session.user.role = token.role
    }
    return session
  },
},
```

### Validações
```typescript
// Validações de senha
- Mínimo 8 caracteres
- Pelo menos 1 letra maiúscula
- Pelo menos 1 número
- Caracteres especiais (recomendado)

// Validações de email
- Formato válido
- Email único (por role)
- Verificação de email (futuro)
```

## 🎨 Interface

### Página de Login
```tsx
<LoginPage>
  <Card>
    <Logo />
    <h1>Bem-vindo de volta</h1>
    
    <Form onSubmit={handleLogin}>
      <Input 
        name="email" 
        type="email" 
        label="Email" 
        required 
      />
      <Input 
        name="password" 
        type="password" 
        label="Senha" 
        required 
      />
      
      <Link href="/forgot-password">
        Esqueceu a senha?
      </Link>
      
      <Button type="submit" loading={isLoading}>
        Entrar
      </Button>
    </Form>
    
    <Divider />
    
    <p>
      Não tem uma conta?{' '}
      <Link href="/signup">Cadastre-se gratuitamente</Link>
    </p>
  </Card>
</LoginPage>
```

### Página de Cadastro
```tsx
<SignUpPage>
  <Card>
    <Logo />
    <h1>Crie sua conta grátis</h1>
    
    <Form onSubmit={handleSignUp}>
      <Input name="name" label="Nome Completo" required />
      <Input name="email" type="email" label="Email" required />
      <Input name="password" type="password" label="Senha" required />
      <Input name="businessName" label="Nome do Negócio" />
      
      <Select name="segmentType" label="Tipo de Negócio" required>
        <Option value="BEAUTY_SALON">Salão de Beleza</Option>
        <Option value="BARBERSHOP">Barbearia</Option>
        <Option value="AESTHETIC_CLINIC">Clínica de Estética</Option>
        {/* ... */}
      </Select>
      
      <Checkbox name="terms" required>
        Aceito os <Link href="/terms">Termos de Uso</Link> e{' '}
        <Link href="/privacy">Política de Privacidade</Link>
      </Checkbox>
      
      <Button type="submit" loading={isLoading}>
        Criar Conta Gratuita
      </Button>
    </Form>
    
    <p className="text-muted">
      Ou{' '}
      <Link href="/signup/standard">
        Começar com plano pago (7 dias grátis)
      </Link>
    </p>
    
    <Divider />
    
    <p>
      Já tem uma conta?{' '}
      <Link href="/login">Faça login</Link>
    </p>
  </Card>
</SignUpPage>
```

## 🎯 Casos de Uso

### 1. Novo Usuário (Freemium)
**Fluxo**:
1. Acessa landing page
2. Clica em "Começar Grátis"
3. Preenche formulário de cadastro
4. Aceita termos
5. Clica em "Criar Conta"
6. Conta criada com plano Freemium
7. Login automático
8. Redirecionado para onboarding/dashboard

### 2. Login Profissional
**Fluxo**:
1. Profissional recebe credenciais do master
2. Acessa `/login`
3. Insere email e senha
4. Sistema identifica role: PROFESSIONAL
5. Login bem-sucedido
6. Redirecionado para dashboard (visão limitada)

### 3. Esqueceu a Senha
**Fluxo**:
1. Usuário clica em "Esqueceu a senha?"
2. Insere email
3. Sistema envia email com link de reset
4. Usuário clica no link
5. Define nova senha
6. Redirecionado para login
7. Faz login com nova senha

## 📧 Emails Transacionais

### Boas-vindas
```typescript
await sendEmail({
  to: user.email,
  subject: 'Bem-vindo ao Calenvo!',
  template: 'welcome',
  data: {
    name: user.name,
    dashboardUrl: `${process.env.NEXT_PUBLIC_URL}/dashboard`,
  },
})
```

### Reset de Senha
```typescript
const token = generateResetToken()

await prisma.passwordResetToken.create({
  data: {
    email: user.email,
    token,
    expires: addHours(new Date(), 1),
  },
})

await sendEmail({
  to: user.email,
  subject: 'Redefinir sua senha',
  template: 'reset-password',
  data: {
    resetUrl: `${process.env.NEXT_PUBLIC_URL}/reset-password?token=${token}`,
  },
})
```

## 🚀 Melhorias Futuras

- [ ] Login social (Google, Facebook)
- [ ] Autenticação de dois fatores (2FA)
- [ ] Verificação de email obrigatória
- [ ] SSO para enterprise
- [ ] Magic link (login sem senha)
- [ ] Biometria (WebAuthn)
- [ ] Histórico de sessões
- [ ] Notificação de login suspeito
- [ ] Expiração de senha (90 dias)
- [ ] Limite de tentativas de login
