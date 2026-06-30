# Technical Specification: Phase 2 UX Enhancements

**Project:** CalenvoApp  
**Feature:** Phase 2 UX Enhancements  
**Created:** January 26, 2026  
**Status:** Approved for Implementation

---

## 1. Overview

This technical specification details the implementation of Phase 2 UX Enhancements including:
1. Reports page with current month focus and date filtering
2. Plans page with real database usage statistics
3. Settings page cleanup and professional URL generation

---

## 2. Constraint Analysis

### Architecture Compliance
- ✅ Follows Next.js 14 App Router patterns
- ✅ Uses Server Components for data fetching
- ✅ Client Components only for interactivity
- ✅ Prisma for all database operations
- ✅ Zod validation for all inputs
- ✅ Authentication with getServerSession

### Breaking Changes Assessment
- ❌ No breaking API changes
- ❌ No breaking database migrations
- ✅ Additive changes only (new fields, new features)
- ✅ Backward compatible

---

## 3. Database Schema Changes

### 3.1 BusinessConfig Table Update

**Modification:** Add optional `publicUrl` field for custom URL slugs

```prisma
model BusinessConfig {
  id                String   @id @default(cuid())
  // ... existing fields ...
  publicUrl         String?  @unique // NEW: Custom URL slug
  
  // ... rest of model
}
```

**Migration Command:**
```bash
npx prisma db push
```

**Justification:** 
- Stores custom booking URL slug generated from business name
- Unique constraint prevents duplicate URLs
- Optional field maintains backward compatibility

---

## 4. API Design

### 4.1 Reports API Enhancement

**Endpoint:** `GET /api/reports/stats`

**Query Parameters:**
```typescript
interface ReportsQuery {
  month?: string  // Format: "YYYY-MM" (e.g., "2026-01")
  year?: string   // Format: "YYYY" (e.g., "2026")
}
```

**Current Implementation Issues:**
- No date filtering (returns all-time data)
- Evolution data hardcoded to 6 months

**New Implementation:**
```typescript
// Default behavior: Current month only
const defaultStartDate = new Date()
defaultStartDate.setDate(1) // First day of current month
defaultStartDate.setHours(0, 0, 0, 0)

const defaultEndDate = new Date()
defaultEndDate.setMonth(defaultEndDate.getMonth() + 1)
defaultEndDate.setDate(0) // Last day of current month
defaultEndDate.setHours(23, 59, 59, 999)

// With filter: Selected month
if (month) {
  const [year, monthNum] = month.split('-')
  startDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1)
  endDate = new Date(parseInt(year), parseInt(monthNum), 0, 23, 59, 59, 999)
}
```

**Response Schema:**
```typescript
interface ReportsResponse {
  period: {
    label: string      // "Janeiro 2026"
    startDate: string  // ISO date
    endDate: string    // ISO date
  }
  mainStats: {
    total: number
    confirmed: number
    cancelled: number
    noShow: number
  }
  servicesStats: Array<{
    serviceName: string
    count: number
    percentage: number
  }>
  evolutionData: Array<{
    month: string
    appointments: number
  }>
}
```

---

### 4.2 Plans Usage API (NEW)

**Endpoint:** `GET /api/plans/usage`

**Purpose:** Fetch real-time plan usage statistics

**Implementation:**
```typescript
// app/api/plans/usage/route.ts
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id
  
  // Get user's plan
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { planType: true }
  })

  // Count appointments this month
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const appointmentsThisMonth = await prisma.appointment.count({
    where: {
      userId,
      date: {
        gte: startOfMonth,
        lte: endOfMonth
      }
    }
  })

  const planConfig = PLAN_CONFIGS[user.planType]
  const usagePercentage = planConfig.monthlyLimit === -1 
    ? 0 
    : Math.round((appointmentsThisMonth / planConfig.monthlyLimit) * 100)

  return NextResponse.json({
    appointmentsThisMonth,
    monthlyLimit: planConfig.monthlyLimit,
    usagePercentage,
    planType: user.planType
  })
}
```

---

### 4.3 Settings API Update

**Endpoint:** `PATCH /api/user/profile`

**New Field:** Handle `businessName` and auto-generate `publicUrl`

**Implementation:**
```typescript
// Add slug generation on businessName update
if (businessName) {
  const slug = generateSlug(businessName)
  
  // Update BusinessConfig with new slug
  await prisma.businessConfig.upsert({
    where: { userId },
    create: {
      userId,
      publicUrl: slug,
      // ... default values
    },
    update: {
      publicUrl: slug
    }
  })
}
```

---

## 5. Utility Functions

### 5.1 Slug Generation

**File:** `lib/utils.ts`

```typescript
/**
 * Generates URL-friendly slug from business name
 * @param businessName - Original business name
 * @returns URL-safe slug (lowercase, no accents, hyphenated)
 * @example
 * generateSlug("Fernanda Guimarães Studio") // "fernanda-guimaraes-studio"
 * generateSlug("Clínica São José") // "clinica-sao-jose"
 */
export function generateSlug(businessName: string): string {
  return businessName
    .toLowerCase()
    .normalize('NFD')                      // Decompose accents
    .replace(/[\u0300-\u036f]/g, '')      // Remove accent marks
    .replace(/[^a-z0-9\s-]/g, '')         // Remove special characters
    .replace(/\s+/g, '-')                  // Replace spaces with hyphens
    .replace(/-+/g, '-')                   // Replace multiple hyphens
    .replace(/^-|-$/g, '')                 // Trim hyphens from ends
    .trim()
}
```

**Test Cases:**
```typescript
// Expected behaviors:
generateSlug("Fernanda Guimarães Studio")  // "fernanda-guimaraes-studio"
generateSlug("Clínica São José")           // "clinica-sao-jose"
generateSlug("Espaço Zen & Beleza")       // "espaco-zen-beleza"
generateSlug("  Multiple   Spaces  ")      // "multiple-spaces"
generateSlug("ABC123 - Teste")             // "abc123-teste"
```

---

## 6. Component Architecture

### 6.1 Reports Page Components

**File:** `app/dashboard/reports/page.tsx`

**Component Type:** Client Component (`'use client'`)  
**Reason:** Needs state management for date filter

**New UI Elements:**
1. **PeriodFilter Component** (inline)
   - Month/Year selector
   - "Current Month" badge
   - Clear filter button

2. **Updated Stats Cards**
   - Display filtered data
   - Show period label

**State Management:**
```typescript
const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null)
const [reportsData, setReportsData] = useState<ReportsResponse | null>(null)
```

**Data Fetching:**
```typescript
useEffect(() => {
  const fetchReports = async () => {
    const params = new URLSearchParams()
    if (selectedPeriod) {
      params.append('month', selectedPeriod)
    }
    
    const response = await fetch(`/api/reports/stats?${params}`)
    const data = await response.json()
    setReportsData(data)
  }
  
  fetchReports()
}, [selectedPeriod])
```

---

### 6.2 Plans Page Components

**File:** `app/dashboard/plans/page.tsx`

**Component Type:** Client Component (`'use client'`)  
**Reason:** Needs to fetch and display dynamic usage data

**Changes:**
1. **Dynamic Usage Stats**
   - Replace hardcoded numbers with API data
   - Add loading state
   - Real-time updates

2. **Premium Plan Display**
   - Conditional rendering for price
   - Show "Sob Consulta" text

**Implementation:**
```typescript
const [usageData, setUsageData] = useState(null)

useEffect(() => {
  fetch('/api/plans/usage')
    .then(res => res.json())
    .then(data => setUsageData(data))
}, [])

// In render:
{config.price === 0 ? (
  <span className="text-3xl font-bold">Grátis</span>
) : planId === 'PREMIUM' ? (
  <span className="text-2xl font-bold text-gray-700">Sob Consulta</span>
) : (
  <span className="text-3xl font-bold">
    {formatCurrency(config.price)}
  </span>
)}
```

---

### 6.3 Settings Page Components

**File:** `app/dashboard/settings/page.tsx`

**Component Type:** Client Component (`'use client'`)

**Changes:**
1. **Remove Components**
   - Delete `<BusinessHoursEditor />` import and usage
   - Delete "Lembretes por WhatsApp" section

2. **Update URL Display**
   - Fetch publicUrl from BusinessConfig
   - Display formatted URL with custom slug

**Updated URL Logic:**
```typescript
const getPublicUrl = () => {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const slug = config.publicUrl || generateSlug(businessName) || 'agendamento'
  return `${baseUrl}/booking/${slug}`
}
```

---

## 7. Implementation Steps

### Step 1: Database Migration
```bash
# Update schema
# Add publicUrl to BusinessConfig model

npx prisma db push
npx prisma generate
```

### Step 2: Utility Function
- [ ] Add `generateSlug()` to `lib/utils.ts`
- [ ] Add unit tests (verify edge cases)

### Step 3: Backend - Reports API
- [ ] Update `app/api/reports/stats/route.ts`
- [ ] Add date filtering logic
- [ ] Default to current month
- [ ] Update response to include period info

### Step 4: Backend - Plans Usage API
- [ ] Create `app/api/plans/usage/route.ts`
- [ ] Implement real-time usage calculation
- [ ] Add authentication check

### Step 5: Backend - Settings API
- [ ] Update `app/api/user/profile/route.ts`
- [ ] Add slug generation on businessName save
- [ ] Update BusinessConfig with publicUrl

### Step 6: Frontend - Reports Page
- [ ] Add month/year filter UI
- [ ] Add period badge
- [ ] Update data fetching with query params
- [ ] Handle loading states

### Step 7: Frontend - Plans Page
- [ ] Add usage data fetching
- [ ] Replace mock data with real data
- [ ] Update Premium plan display

### Step 8: Frontend - Settings Page
- [ ] Remove BusinessHoursEditor component
- [ ] Remove WhatsApp reminders section
- [ ] Update URL display logic

### Step 9: Quality Assurance
- [ ] Run `npm run lint`
- [ ] Run `npm run build`
- [ ] Manual testing of all features
- [ ] Verify data accuracy

---

## 8. Testing Strategy

### 8.1 Verification Script

**File:** `scripts/verify-phase-2.ts`

```typescript
import { prisma } from '@/lib/db'
import { generateSlug } from '@/lib/utils'

async function verifyPhase2() {
  console.log('🔍 Verifying Phase 2 Implementation...\n')
  
  // Test 1: Slug generation
  console.log('Test 1: Slug Generation')
  const testCases = [
    'Fernanda Guimarães Studio',
    'Clínica São José',
    'Espaço Zen & Beleza'
  ]
  
  testCases.forEach(name => {
    const slug = generateSlug(name)
    console.log(`  ${name} → ${slug}`)
  })
  
  // Test 2: Current month appointments
  console.log('\nTest 2: Current Month Appointments')
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  
  const count = await prisma.appointment.count({
    where: {
      date: { gte: startOfMonth }
    }
  })
  
  console.log(`  Appointments this month: ${count}`)
  
  console.log('\n✅ Verification complete')
}

verifyPhase2()
```

### 8.2 Manual Testing Checklist

**Reports:**
- [ ] Default shows current month data
- [ ] Period badge displays correctly
- [ ] Filter updates all metrics
- [ ] Data matches database

**Plans:**
- [ ] Real appointment count displays
- [ ] Usage percentage calculates correctly
- [ ] Premium shows "Sob Consulta"
- [ ] Loading states work

**Settings:**
- [ ] BusinessHoursEditor removed
- [ ] WhatsApp section removed
- [ ] URL generates correctly
- [ ] Accents handled properly

---

## 9. Performance Considerations

### Database Queries
- Add index on `appointment.date` for faster filtering
- Add index on `businessConfig.publicUrl` for unique constraint

```prisma
model Appointment {
  // ...
  @@index([userId, date])
}
```

### Caching Strategy
- Reports data: No caching (real-time accuracy needed)
- Plan usage: Consider short cache (1 minute)
- Public URL: Cache on client until manual refresh

---

## 10. Error Handling

### API Errors
```typescript
try {
  // ... API logic
} catch (error) {
  console.error('Error in Phase 2 API:', error)
  return NextResponse.json(
    { error: 'Falha ao processar solicitação' },
    { status: 500 }
  )
}
```

### Client Errors
```typescript
try {
  const response = await fetch('/api/reports/stats')
  if (!response.ok) {
    throw new Error('Failed to fetch')
  }
  // ... handle data
} catch (error) {
  toast.error('Erro ao carregar relatórios')
  console.error(error)
}
```

---

## 11. Security Checklist

- [x] All APIs use `getServerSession` authentication
- [x] Input validation with Zod schemas
- [x] SQL injection prevented (Prisma ORM)
- [x] XSS prevention (React escaping)
- [x] CSRF protection (Next.js built-in)
- [x] Rate limiting (via middleware if needed)

---

## 12. Rollback Plan

If issues arise:

1. **Database:** No destructive changes, safe to rollback
2. **Code:** Revert commits via git
3. **URLs:** Old URL format still works (fallback logic)

---

## 13. Definition of Done

- [ ] All code follows `.agent/rules/coding-standards.md`
- [ ] All APIs have authentication
- [ ] All inputs are validated
- [ ] Lint passes with no errors
- [ ] Build completes successfully
- [ ] Manual testing completed
- [ ] Documentation updated
- [ ] All acceptance criteria met

---

**Approved By:** User  
**Implementation Start:** January 26, 2026  
**Estimated Completion:** January 26, 2026
