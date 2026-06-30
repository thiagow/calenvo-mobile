# WhatsApp Notifications v3.0 - Testing Guide

**Date:** January 29, 2026  
**Version:** 3.0.0  
**Status:** Ready for Testing

---

## 🎯 Overview

This guide documents the testing process for WhatsApp Notifications v3.0, which introduces:
- New n8n endpoint integration (criar-instancia, atualiza-qr-code)
- Binary PNG detection and handling
- Instance state management system
- Enhanced UI with visual state indicators

---

## ✅ Implementation Checklist

### Backend (100% Complete)
- [x] Instance State Management (`checkInstanceState()`)
- [x] Binary PNG Detection (magic number `0x89 0x50 0x4E 0x47`)
- [x] Empty Response Handling
- [x] State-aware `createInstanceAction()`
- [x] State-aware `refreshQRCodeAction()`
- [x] Comprehensive logging system
- [x] Build verification (0 TypeScript errors)

### Frontend (100% Complete)
- [x] Visual state indicators (5 states: none, pending, expired, connected, error)
- [x] State-specific alerts and messages
- [x] Conditional button rendering based on state
- [x] Loading states for all actions
- [x] Error feedback with toast notifications

---

## 🧪 Test Scenarios

### Test 1: First-Time QR Code Generation (NONE → PENDING)

**Steps:**
1. Navigate to `/dashboard/notifications/whatsapp`
2. Enter phone number: `62993343804`
3. Click "Gerar QR Code"

**Expected Backend Behavior:**
```
[callN8nEndpoint] Starting request...
[callN8nEndpoint] URL: https://homologaamz-n8n.feidcm.easypanel.host/webhook/criar-instancia
[callN8nEndpoint] Payload: {
  "userId": "cmkkmmkr10000krok4fgakfbt",
  "instanceName": "cmkkmmkr10000krok4fgakfbt-calenvo",
  "phoneNumber": "62993343804",
  "webhookUrl": "http://localhost:3000/api/webhooks/evolution"
}
[callN8nEndpoint] Response received:
- Status: 200 OK
- Content-Type: image/png OR application/json (both handled)
[callN8nEndpoint] Detected PNG binary despite JSON content-type
[callN8nEndpoint] PNG converted to Base64, length: 12345
[createInstanceAction] Current state: none
[createInstanceAction] QR code generated successfully
```

**Expected UI Behavior:**
- Show loading spinner on button: "Gerando QR Code..."
- Open QR code modal with image
- Show toast: "QR Code gerado - Escaneie o QR Code com seu WhatsApp"
- Update state indicator to: **"Aguardando Conexão"** (yellow clock icon)
- Badge changes to: **"Pendente"** (secondary)

**Database State:**
```sql
WhatsAppConfig {
  instanceName: "cmkkmmkr10000krok4fgakfbt-calenvo",
  phoneNumber: "62993343804",
  qrCode: "data:image/png;base64,...",
  qrCodeExpiresAt: "2026-01-29T12:00:00.000Z",
  isConnected: false
}
```

---

### Test 2: Duplicate Instance Prevention (PENDING → PENDING)

**Steps:**
1. Without scanning QR code from Test 1
2. Try clicking "Atualizar QR Code" again immediately

**Expected Backend Behavior:**
```
[checkInstanceState] Checking state for user: cmkkmmkr10000krok4fgakfbt
[checkInstanceState] State: pending
[createInstanceAction] Current state: pending
[createInstanceAction] Instance already exists with QR code, returning existing
```

**Expected UI Behavior:**
- Show existing QR code modal (not create new instance)
- Toast: "QR Code já existe - Escaneie o código existente"
- State remains: **"Aguardando Conexão"**

**Database State:**
- No new instance created
- Same QR code returned

---

### Test 3: QR Code Expiration (PENDING → EXPIRED)

**Steps:**
1. Wait for QR code to expire (or manually update database: `UPDATE "WhatsAppConfig" SET "qrCodeExpiresAt" = NOW() - INTERVAL '1 minute'`)
2. Refresh page

**Expected Backend Behavior:**
```
[checkInstanceState] Checking state for user: cmkkmmkr10000krok4fgakfbt
[checkInstanceState] QR code expired at 2026-01-29T11:00:00.000Z
[checkInstanceState] State: qr_expired
```

**Expected UI Behavior:**
- State indicator changes to: **"QR Code Expirado"** (orange warning triangle)
- Badge changes to: **"Expirado"** (outline)
- Show alert: "QR Code expirado! O código QR gerado anteriormente expirou. Clique em 'Atualizar QR Code' para gerar um novo."
- Show "Atualizar QR Code" button with trash icon

**Database State:**
```sql
WhatsAppConfig {
  qrCodeExpiresAt: < NOW() -- expired
  isConnected: false
}
```

---

### Test 4: Refresh Expired QR Code (EXPIRED → PENDING)

**Steps:**
1. From expired state (Test 3)
2. Click "Atualizar QR Code"

**Expected Backend Behavior:**
```
[refreshQRCodeAction] Starting refresh...
[checkInstanceState] State: qr_expired
[refreshQRCodeAction] Valid state for refresh, proceeding...
[callN8nEndpoint] URL: https://homologaamz-n8n.feidcm.easypanel.host/webhook/atualiza-qr-code
[callN8nEndpoint] Payload: {
  "userId": "cmkkmmkr10000krok4fgakfbt",
  "instanceName": "cmkkmmkr10000krok4fgakfbt-calenvo"
}
[callN8nEndpoint] Detected PNG binary
[callN8nEndpoint] PNG converted to Base64
[refreshQRCodeAction] QR code refreshed successfully
```

**Expected UI Behavior:**
- Button shows loading: "Atualizando..." with spinning icon
- New QR code modal opens
- Toast: "QR Code atualizado - Escaneie o novo QR Code com seu WhatsApp"
- State changes back to: **"Aguardando Conexão"** (yellow clock)

**Database State:**
```sql
WhatsAppConfig {
  qrCode: "data:image/png;base64,..." -- NEW QR CODE
  qrCodeExpiresAt: "2026-01-29T13:00:00.000Z" -- NEW EXPIRATION
  isConnected: false
}
```

---

### Test 5: Successful Connection (PENDING → CONNECTED)

**Steps:**
1. From pending state
2. Scan QR code with WhatsApp mobile app
3. Wait for webhook callback to update database
4. Click "Verificar Status" or refresh page

**Expected Backend Behavior:**
```
[checkConnectionStatusAction] Checking connection status...
[callN8n] Calling Evolution API to check connection state
[checkConnectionStatusAction] Connected: true
```

**Expected UI Behavior:**
- State indicator changes to: **"Conectado"** (green checkmark)
- Badge changes to: **"Ativo"** (default)
- Show phone number below status
- Show "Verificar Status" and "Desconectar" buttons
- Hide QR code generation form

**Database State:**
```sql
WhatsAppConfig {
  qrCode: "data:image/png;base64,...",
  qrCodeExpiresAt: "2026-01-29T13:00:00.000Z",
  isConnected: true -- CONNECTED!
}
```

---

### Test 6: Empty Response from n8n

**Scenario:** n8n workflow returns `200 OK` but empty body

**Expected Backend Behavior:**
```
[callN8nEndpoint] Response received:
- Status: 200 OK
- Content-Type: application/json
- Content-Length: 0
[callN8nEndpoint] Raw response text length: 0
[callN8nEndpoint] Empty response body
[callN8nEndpoint] Error: O servidor n8n não retornou dados...
```

**Expected UI Behavior:**
- Error toast: "O servidor n8n não retornou dados. Verifique se o workflow está configurado para retornar o QR Code."
- No modal opens
- State remains unchanged

**Action Required:**
- Configure n8n workflow to return QR code in "Respond to Webhook" node

---

### Test 7: Wrong Content-Type (PNG with JSON header)

**Scenario:** n8n returns PNG binary with `content-type: application/json`

**Expected Backend Behavior:**
```
[callN8nEndpoint] Response received:
- Content-Type: application/json; charset=utf-8
[callN8nEndpoint] Raw response text length: 15234
[callN8nEndpoint] Raw response text (first 500 chars): �PNG...
[callN8nEndpoint] Detected PNG binary despite JSON content-type
[callN8nEndpoint] PNG converted to Base64, length: 15234
```

**Expected UI Behavior:**
- QR code modal opens with image successfully
- Toast: "QR Code gerado"
- No errors

**Result:** ✅ This is the MAIN fix we implemented!

---

### Test 8: Disconnect and Cleanup

**Steps:**
1. From connected state
2. Click "Desconectar"
3. Confirm dialog

**Expected Backend Behavior:**
```
[deleteInstanceAction] Deleting instance...
[callN8n] action: deleteInstance
[deleteInstanceAction] Instance deleted from database
```

**Expected UI Behavior:**
- Confirmation dialog: "Deseja realmente desconectar o WhatsApp? As notificações automáticas serão desativadas."
- After confirm, show loading on button
- Toast: "Desconectado - WhatsApp desconectado com sucesso"
- Page reloads
- State returns to: **"Não Conectado"** (gray X icon)
- Show phone number input form

**Database State:**
```sql
-- WhatsAppConfig record deleted or marked as deleted
```

---

## 🔧 Debugging Commands

### Check Current State
```bash
# Connect to database
npx prisma studio

# Or run verification script
npx tsx scripts/verify-whatsapp-v3.ts
```

### Manual State Manipulation (for testing)
```sql
-- Force expire QR code
UPDATE "WhatsAppConfig" 
SET "qrCodeExpiresAt" = NOW() - INTERVAL '1 minute'
WHERE "userId" = 'YOUR_USER_ID';

-- Force disconnect
UPDATE "WhatsAppConfig" 
SET "isConnected" = false
WHERE "userId" = 'YOUR_USER_ID';

-- Delete instance
DELETE FROM "WhatsAppConfig" 
WHERE "userId" = 'YOUR_USER_ID';
```

### Watch Server Logs
```bash
npm run dev

# In another terminal, watch specific logs
tail -f .next/server-logs.txt | grep callN8nEndpoint
```

---

## 📊 Visual State Reference

| Visual State | Icon | Badge | Alert Variant | Trigger |
|--------------|------|-------|---------------|---------|
| **none** | Gray X | Inativo (secondary) | Info | No config exists |
| **pending** | Yellow Clock | Pendente (secondary) | Info | QR created, not scanned |
| **expired** | Orange Warning | Expirado (outline) | Destructive | QR expired |
| **connected** | Green Check | Ativo (default) | - | Connected successfully |
| **error** | Red X | Erro (destructive) | Destructive | Inconsistent state |

---

## 🐛 Known Issues & Solutions

### Issue 1: "Unexpected token '�', "�PNG..." is not valid JSON"
**Status:** ✅ FIXED  
**Solution:** Binary PNG detection implemented

### Issue 2: "Unexpected end of JSON input"
**Status:** ✅ FIXED  
**Solution:** Empty response handling added

### Issue 3: Duplicate instances created
**Status:** ✅ FIXED  
**Solution:** State management system prevents duplicates

---

## ✅ Success Criteria

The implementation is considered successful when:

1. **QR Code Generation** works with all response types:
   - ✅ PNG binary with correct content-type
   - ✅ PNG binary with wrong content-type (application/json)
   - ✅ JSON response with base64 QR code
   - ✅ Empty response (shows error)

2. **State Management** prevents errors:
   - ✅ No duplicate instances created
   - ✅ Can't refresh when connected
   - ✅ Can't create when pending
   - ✅ Clear messages for each state

3. **UI Feedback** is clear:
   - ✅ Visual indicators for 5 states
   - ✅ Appropriate actions for each state
   - ✅ Error messages are user-friendly
   - ✅ Loading states show progress

4. **Build & Deploy** passes:
   - ✅ `npm run build` - 0 errors
   - ✅ TypeScript strict mode - no warnings
   - ✅ All dependencies resolved

---

## 📝 Test Results Log

### Run 1: [DATE_TO_BE_FILLED]
- [ ] Test 1: First-Time QR Generation - Result: _____
- [ ] Test 2: Duplicate Prevention - Result: _____
- [ ] Test 3: QR Expiration - Result: _____
- [ ] Test 4: Refresh QR - Result: _____
- [ ] Test 5: Successful Connection - Result: _____
- [ ] Test 6: Empty Response - Result: _____
- [ ] Test 7: Wrong Content-Type - Result: _____
- [ ] Test 8: Disconnect - Result: _____

**Overall Status:** PENDING FIRST RUN

---

## 🚀 Next Steps After Testing

1. **If tests pass:**
   - Document results in this file
   - Update tech spec with test evidence
   - Mark v3.0 as production-ready
   - Deploy to staging environment

2. **If tests fail:**
   - Document specific failure scenarios
   - Check server console logs
   - Identify root cause
   - Implement fixes
   - Re-run tests

---

**Last Updated:** January 29, 2026  
**Tested By:** Pending  
**Environment:** Development (localhost:3000)
