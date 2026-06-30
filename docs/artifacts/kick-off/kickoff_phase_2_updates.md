# Feature Kickoff: Phase 2 UX Enhancements

**Project:** CalenvoApp  
**Date:** January 26, 2026  
**Status:** In Development  
**Priority:** High

---

## 1. Feature Snapshot

### Overview
Phase 2 UX Enhancements focus on improving data accuracy in reports, streamlining configuration workflows, and enhancing professional branding through customized booking URLs.

### User Persona
**Primary:** Business Owner (Master User)

### Value Proposition
- **Reports:** Accurate current-month metrics with historical filtering capabilities
- **Plans:** Real-time usage statistics for informed subscription decisions
- **Settings:** Streamlined configuration with professional branded URLs

---

## 2. User Stories

### 🔍 Reports (Relatórios) - Must Have

**US-01: Current Month Focus**
> As a business owner, I want to see metrics clearly labeled as belonging to the current month by default, so that I can understand my current performance at a glance.

**Acceptance Criteria:**
- [ ] Page displays "Mês de Referência: [Current Month Year]" badge
- [ ] All statistics default to current month data
- [ ] Evolution chart shows last 6 months including current

**US-02: Historical Filtering**
> As a business owner, I want to filter reports by month and year, so that I can analyze historical trends and compare different periods.

**Acceptance Criteria:**
- [ ] Month/Year selector component is available
- [ ] Selecting a period updates all metrics dynamically
- [ ] URL updates with query parameters for sharing

---

### 💳 Plans (Planos) - Must Have

**US-03: Real Usage Statistics**
> As a business owner, I want to see real usage statistics from the database in the "Current Plan Status" section, so that I can make informed decisions about my subscription.

**Acceptance Criteria:**
- [ ] "Agendamentos este mês" shows actual database count
- [ ] Usage percentage is calculated correctly
- [ ] Data updates in real-time

**US-04: Premium Plan Pricing**
> As a business owner, I want the Premium plan price to display as "Sob Consulta", so that it reflects proper sales processes for enterprise plans.

**Acceptance Criteria:**
- [ ] Premium plan shows "Sob Consulta" instead of price
- [ ] Upgrade button has appropriate enterprise messaging

---

### ⚙️ Settings (Configurações) - Must Have

**US-05: Configuration Cleanup**
> As a business owner, I want the Standard Business Hours configuration removed from Settings, so that all time management is centralized in the Agenda page and avoids confusion.

**Acceptance Criteria:**
- [ ] BusinessHoursEditor component removed
- [ ] "Lembretes por WhatsApp" section removed
- [ ] Other functionality remains intact

**US-06: Professional URL Generation**
> As a business owner, I want my booking URL to be automatically generated from my Business Name with proper formatting, so that my brand appears more professional and trustworthy.

**Acceptance Criteria:**
- [ ] URL slug generated from Business Name
- [ ] Format: lowercase, no accents, hyphens for spaces
- [ ] Stored in database (BusinessConfig.publicUrl)
- [ ] Example: "Fernanda Guimarães Studio" → "fernanda-guimaraes-studio"

---

## 3. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Report Data Accuracy | 100% | Database count matches UI display |
| User Task Completion | < 30 seconds | Time to generate professional URL |
| Configuration Simplicity | -50% | Reduction in settings complexity |
| URL Professionalism | Branded URLs | Custom slugs based on business name |

---

## 4. Technical Scope

### In Scope
- ✅ Reports month/year filtering
- ✅ Real-time plan usage statistics
- ✅ URL slug generation and storage
- ✅ Settings page cleanup

### Out of Scope
- ❌ Payment integration for plans
- ❌ WhatsApp integration implementation
- ❌ Advanced reporting (charts, exports)
- ❌ Multi-language support

---

## 5. Dependencies

### Technical
- Prisma ORM (database queries)
- NextAuth.js (session management)
- Next.js 14 App Router
- Shadcn/UI components

### Data Model
- `BusinessConfig` table (for URL slug storage)
- `Appointment` table (for usage statistics)
- `User` table (for plan information)

---

## 6. Implementation Timeline

### Phase 1: Documentation (Completed)
- [x] Requirements gathering
- [x] User story validation
- [ ] Technical specification

### Phase 2: Development (In Progress)
- [ ] Reports enhancement
- [ ] Plans data integration
- [ ] Settings cleanup

### Phase 3: Quality Assurance
- [ ] Manual testing
- [ ] Lint checks
- [ ] Build verification

---

## 7. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| URL slug conflicts | Medium | Medium | Add uniqueness validation + fallback |
| Performance with date filters | Low | Low | Add database indexes on date fields |
| Breaking existing URLs | High | High | Maintain backward compatibility |

---

## 8. Stakeholder Approval

- [x] User Persona validated
- [x] Goals confirmed
- [x] Success metrics agreed
- [ ] Technical spec approved
- [ ] Implementation started

---

**Next Steps:**
1. Create technical specification
2. Implement Reports enhancement
3. Implement Plans data integration
4. Implement Settings cleanup
5. Quality checks and testing
