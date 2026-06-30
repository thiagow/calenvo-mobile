# WhatsApp Integration v3.1 (n8n Workflow)

## 📋 Overview

The WhatsApp integration in CalenvoApp v3.1 uses a robust n8n-based architecture to handle automated notifications, instance management, and real-time connection monitoring. This system ensures high reliability and a seamless user experience for business owners to connect their WhatsApp Business accounts.

---

## 🏗️ Architecture

The integration follows a decoupled architecture:
1. **Frontend (Next.js)**: React components for managing connection and settings.
2. **Server Actions (Next.js)**: Secure logic for communicating with n8n and managing database state.
3. **n8n Workflows**: Middleware that interfaces with the WhatsApp API (Evolution) for instance management and message dispatch.
4. **PostgreSQL (Prisma)**: Stores configuration, connection states, and notification preferences.

---

## 📍 Key Components

### 🖥️ UI Components
- `WhatsAppConnection`: Main dashboard component for connection lifecycle.
- `QRCodeModal`: Optimized 2-column responsive modal for scanning QR codes.
- `NotificationSettings`: Form for customizing message templates and delays.

### ⚙️ Server Logic
- `app/actions/whatsapp.ts`: Core server actions for all WhatsApp operations.
- `useStatusPolling`: Custom hook for 30s status verification with visual countdown.
- `WhatsAppTriggerService`: Central logic for triggering notifications from business events.

---

## 🔄 Connection Lifecycle

### 1. Instance Creation
- **Endpoint**: `N8N_CREATE_INSTANCE_URL`
- **Logic**: User enters their phone number. The system calls n8n to create or update an instance.
- **Output**: A base64 QR code is returned and stored in the database.

### 2. QR Code Scanning
- **Modal**: Displays the QR code in a responsive, user-friendly layout.
- **Persistence**: Modal state is saved in `sessionStorage`, allowing it to persist across accidental page reloads.
- **Timer**: A 30-second visual countdown informs the user when the next automatic status check will occur.

### 3. Real-time Status Polling
- **Interval**: 30 seconds (optimized from 2s to reduce server load).
- **Mechanism**: While the modal is open, the system automatically checks connection status.
- **Completion**: Once connected, a single "Conectado ✓" toast is shown, followed by a controlled page reload after 1.5s.

### 4. Manual Verification
- **Button**: "Verificar Status" is always available on the dashboard when the modal is closed.
- **Usage**: Allows users to force a status sync with n8n at any time.

---

## 🗄️ Data Model (`WhatsAppConfig`)

```prisma
model WhatsAppConfig {
  id                  String    @id @default(cuid())
  instanceName        String    @unique
  phoneNumber         String?
  isConnected         Boolean   @default(false)
  qrCode              String?   @db.Text
  qrCodeExpiresAt     DateTime?
  enabled             Boolean   @default(false)
  
  // Notification Templates
  createMessage       String?   @db.Text
  cancelMessage       String?   @db.Text
  confirmationMessage String?   @db.Text
  reminderMessage     String?   @db.Text
  
  // Timings & Delays
  createDelayMinutes  Int       @default(0)
  cancelDelayMinutes  Int       @default(0)
  reminderHours       Int       @default(24)
  
  userId              String    @unique
  user                User      @relation(fields: [userId], references: [id])
}
```

---

## 🔗 n8n Endpoints (v3.1)

| Variable | Purpose |
|----------|---------|
| `N8N_CREATE_INSTANCE_URL` | Creates a new instance or refreshes QR for existing one |
| `N8N_STATUS_URL` | Checks if the instance is currently connected (open/close) |
| `N8N_DELETE_URL` | Completely removes the instance from n8n and local DB |
| `N8N_WEBHOOK_URL` | Main webhook for generic actions like sending messages |

---

## 📝 Notification Templates

Templates support dynamic variables:
- `{{nome_cliente}}`: Client's full name
- `{{data}}`: Appointment date (DD/MM/YYYY)
- `{{hora}}`: Appointment time (HH:mm)
- `{{servico}}`: Name of the service
- `{{profissional}}`: Assigned professional's name
- `{{empresa}}`: Your business name

---

## 🔧 Troubleshooting (v3.1)

### QR Code not loading
- Check if `N8N_CREATE_INSTANCE_URL` is correctly configured in `.env`.
- Ensure n8n workflow is active and reachable.

### Modal closes too fast
- *Fixed in v3.1*: The system now uses 30s polling and sessionStorage persistence. If it still closes, check for browser console errors.

### Instance "Ghosting"
- *Fixed in v3.1*: "Desconectar" now performs a hard DELETE in the database instead of just updating fields.

### Status stays "Pendente" after scan
- Use the "Verificar Status Manualmente" button to force a sync.
- Ensure the phone has a stable internet connection.

---

## 🛠️ Developer Notes

- **Binary PNGs**: The `callN8nEndpoint` wrapper automatically detects raw PNG binary data from n8n and converts it to a base64 Data URL for the UI.
- **State Management**: Uses an internal `InstanceState` enum to handle the complex transitions between None, Pending, Expired, and Connected.
- **Cleanup**: Polling automatically stops when the modal is closed to preserve resources.
